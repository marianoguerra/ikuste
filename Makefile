
build:
	mkdir -p dist
	cp lib/vue.min.js dist/ikuste.min.js
	echo ";" >> dist/ikuste.min.js
	uglifyjs js/pathparser.js js/ikuste.js >> dist/ikuste.min.js

js/pathparser.js: resources/pathparser.jison
	cat resources/pathparser.jison | node_modules/.bin/jison > js/pathparser.js

.PHONY: test-parser
test-parser:
	node resources/test-parser.js resources/path-examples.txt
