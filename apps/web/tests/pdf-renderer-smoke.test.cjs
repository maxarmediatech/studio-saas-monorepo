const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { Document, Page, Text, renderToStream } = require('@react-pdf/renderer');

test('react-pdf renderer can stream a basic document', async () => {
  const element = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4' },
      React.createElement(Text, null, 'pdf smoke test')
    )
  );

  const stream = await renderToStream(element);
  assert.ok(stream, 'expected a readable stream');
});
