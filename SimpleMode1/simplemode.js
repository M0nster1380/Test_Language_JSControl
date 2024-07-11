// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/5/LICENSE

// Начало и подключение модуля
  /* Этот блок кода используется для определения модуля, совместимого с различными средами 
  (CommonJS, AMD и браузером). Он обеспечивает загрузку зависимости CodeMirror. */
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

// Определение режима
  /* Определяется новый режим с именем simplemode2. config содержит 
  параметры конфигурации, такие как indentUnit. */
CodeMirror.defineMode("simplemode", function(config) {
  var indentUnit = config.indentUnit;
  
  // Определение ключевых слов и атомов 
    /* keywords и atoms содержат ключевые слова и атомы вашего языка, которые будут 
    выделяться особым образом. Эти объекты можно заменить на соответствующие 
    ключевые слова и атомы вашего языка программирования. */
  var keywords = {
    "break":true, "case":true, "chan":true, "const":true, "continue":true,
    "default":true, "defer":true, "else":true, "fallthrough":true, "for":true,
    "func":true, "go":true, "goto":true, "if":true, "import":true,
    "interface":true, "map":true, "package":true, "range":true, "return":true,
    "select":true, "struct":true, "switch":true, "type":true, "var":true,
    "bool":true, "byte":true, "complex64":true, "complex128":true,
    "float32":true, "float64":true, "int8":true, "int16":true, "int32":true,
    "int64":true, "string":true, "uint8":true, "uint16":true, "uint32":true,
    "uint64":true, "int":true, "uint":true, "uintptr":true, "error": true,
    "rune":true, "any":true, "comparable":true
  };

  var atoms = {
    "true":true, "false":true, "iota":true, "nil":true, "append":true,
    "cap":true, "close":true, "complex":true, "copy":true, "delete":true, "imag":true,
    "len":true, "make":true, "new":true, "panic":true, "print":true,
    "println":true, "real":true, "recover":true
  };

  // Определение операторов
    /* Регулярное выражение isOperatorChar определяет символы операторов. 
    Это регулярное выражение можно настроить для операторов вашего языка. */
  var isOperatorChar = /[+\-*&^%:=<>!|\/]/;

  var curPunc;

  // Функции токенизации
  // Основная функция токенизации
    /* Эта функция определяет правила токенизации для различных элементов языка. 
    Она обрабатывает строки, числа, комментарии, операторы и прочие символы. */
  function tokenBase(stream, state) {
    var ch = stream.next();
    if (ch == '"' || ch == "'" || ch == "`") {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    }
    if (/[\d\.]/.test(ch)) {
      if (ch == ".") {
        stream.match(/^[0-9_]+([eE][\-+]?[0-9_]+)?/);
      } else if (ch == "0") {
        stream.match(/^[xX][0-9a-fA-F_]+/) || stream.match(/^[0-7_]+/);
      } else {
        stream.match(/^[0-9_]*\.?[0-9_]*([eE][\-+]?[0-9_]+)?/);
      }
      return "number";
    }
    if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
      curPunc = ch;
      return null;
    }
    if (ch == "/") {
      if (stream.eat("*")) {
        state.tokenize = tokenComment;
        return tokenComment(stream, state);
      }
      if (stream.eat("/")) {
        stream.skipToEnd();
        return "comment";
      }
    }
    if (isOperatorChar.test(ch)) {
      stream.eatWhile(isOperatorChar);
      return "operator";
    }
    stream.eatWhile(/[\w\$_\xa1-\uffff]/);
    var cur = stream.current();
    if (keywords.propertyIsEnumerable(cur)) {
      if (cur == "case" || cur == "default") curPunc = "case";
      return "keyword";
    }
    if (atoms.propertyIsEnumerable(cur)) return "atom";
    return "variable";
  }

  // Функция токенизации строк
    /* Эта функция обрабатывает строки. Она продолжает токенизацию 
    до конца строки или до обнаружения соответствующей закрывающей кавычки. */
  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) {end = true; break;}
        escaped = !escaped && quote != "`" && next == "\\";
      }
      if (end || !(escaped || quote == "`"))
        state.tokenize = tokenBase;
      return "string";
    };
  }

  // Функция токенизации комментариев
    /* Эта функция обрабатывает многострочные комментарии. 
    Она продолжает токенизацию до конца комментария (*/). */
  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return "comment";
  }
  
  // Контекст и отступы
  // Контекст
    /* Эти функции управляют контекстом токенизации. Они помогают правильно 
    обрабатывать вложенные конструкции, такие как скобки и фигурные скобки. */
  function Context(indented, column, type, align, prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.align = align;
    this.prev = prev;
  }
  function pushContext(state, col, type) {
    return state.context = new Context(state.indented, col, type, null, state.context);
  }
  function popContext(state) {
    if (!state.context.prev) return;
    var t = state.context.type;
    if (t == ")" || t == "]" || t == "}")
      state.indented = state.context.indented;
    return state.context = state.context.prev;
  }

  // Interface
  // Интерфейс режима
  // Начальное состояние
    /* Эта функция инициализирует начальное состояние режима. */
  return {
    startState: function(basecolumn) {
      return {
        tokenize: null,
        context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
        indented: 0,
        startOfLine: true
      };
    },

    // Основная функция токенизации
      /* Эта функция выполняет токенизацию одной строки. Она использует 
      состояние и контекст для правильной обработки вложенных конструкций. */
    token: function(stream, state) {
      var ctx = state.context;
      if (stream.sol()) {
        if (ctx.align == null) ctx.align = false;
        state.indented = stream.indentation();
        state.startOfLine = true;
        if (ctx.type == "case") ctx.type = "}";
      }
      if (stream.eatSpace()) return null;
      curPunc = null;
      var style = (state.tokenize || tokenBase)(stream, state);
      if (style == "comment") return style;
      if (ctx.align == null) ctx.align = true;

      if (curPunc == "{") pushContext(state, stream.column(), "}");
      else if (curPunc == "[") pushContext(state, stream.column(), "]");
      else if (curPunc == "(") pushContext(state, stream.column(), ")");
      else if (curPunc == "case") ctx.type = "case";
      else if (curPunc == "}" && ctx.type == "}") popContext(state);
      else if (curPunc == ctx.type) popContext(state);
      state.startOfLine = false;
      return style;
    },
    
    // Функция отступов
      /* Эта функция определяет, как должны выполняться отступы для различных строк, основываясь на контексте. */
    indent: function(state, textAfter) {
      if (state.tokenize != tokenBase && state.tokenize != null) return CodeMirror.Pass;
      var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
      if (ctx.type == "case" && /^(?:case|default)\b/.test(textAfter)) {
        state.context.type = "}";
        return ctx.indented;
      }
      var closing = firstChar == ctx.type;
      if (ctx.align) return ctx.column + (closing ? 0 : 1);
      else return ctx.indented + (closing ? 0 : indentUnit);
    },

    // Дополнительные параметры
      /* Эти параметры определяют дополнительные функции режима, такие как автоматическое 
      закрытие скобок, складывание блоков кода и формат комментариев. */
    electricChars: "{}):",
    closeBrackets: "()[]{}''\"\"``",
    fold: "brace",
    blockCommentStart: "/*",
    blockCommentEnd: "*/",
    lineComment: "//"
  };
});

  // Определение MIME-типа
  /* Этот код связывает MIME-тип text/x-go с созданным режимом. */
CodeMirror.defineMIME("text/x-go", "go");

});
