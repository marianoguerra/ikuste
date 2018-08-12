%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
[a-zA-Z]([a-zA-Z_0-9]*)  return 'IDENTIFIER'
\$[a-zA-Z]([a-zA-Z_0-9]*)  return 'VAR'
"."                   return 'DOT'
\[                   return 'OPEN'
\]                   return 'CLOSE'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

%start expressions

%% /* language grammar */

expressions
    : path EOF
        {return $1;}
    ;

path
    : firstPathItem
        {$$ = [$1];}
    | firstPathItem nextPathItems
        {$$ = [$1].concat($2);}
    ;

nextPathItems
    : nextPathItem nextPathItems
        {$$ = [$1].concat($2);}
    | nextPathItem
        {$$ = [$1];}
    ;

nextPathItem
    : DOT IDENTIFIER
        {$$ = ['i', $2];}
    | pathItem
        {$$ = $1;}
    ;

firstPathItem
    : IDENTIFIER
        {$$ = ['i', $1];}
    | pathItem
        {$$ = $1;}
    ;

pathItem
	: OPEN VAR CLOSE
        {$$ = ['v', $2.slice(1)];}
	| OPEN NUMBER CLOSE
        {$$ = ['n', new Number($2)];}
	| OPEN path CLOSE
        {$$ = ['m', $2];}
	;
