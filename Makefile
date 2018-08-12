
js/pathparser.js: resources/pathparser.jison
	cat resources/pathparser.jison | node_modules/.bin/jison > js/pathparser.js

.PHONY: test-parser
test-parser:
	node resources/test-parser.js resources/path-examples.txt
