/* jslint indent: 2, maxlen: 80, node: true, white: true, vars: true */
/* globals describe, it, beforeEach, afterEach */


const async = require('async');
const collectStream = require('collect-stream');
const common = require('./lib/common');

describe.skip('Tricky paths', () => {
  let client;
  let server;

  // run tests both ways
  [true, false].forEach((useReadFile) => {
    describe(`with useReadFile = ${useReadFile}`, () => {
      beforeEach((done) => {
        server = common.server({ useReadFile });
        client = common.client(done);
      });

      test('should cope with unusual paths', (done) => {
        const coolGlasses = '\uD83D\uDE0E';
        const trickyName = "b\\\\s\\l, \"\"q'u\"o\"te''; pi|p|e & ^up^";
        const dirPath = `tricky_paths/${trickyName}`;
        const expectedData = `good ${coolGlasses}\nfilesystem.\n`;

        function receiveAndCompare(socket, nxt) {
          collectStream(socket, (error, receivedData) => {
            common.should.not.exist(error);
            String(receivedData).should.eql(expectedData);
            nxt();
          });
          socket.resume();
        }

        async.waterfall([
          function strangePathRedundantEscape(nxt) {
            const dirRfcQuoted = dirPath.replace(/"/g, '""');
            server.suppressExpecteErrMsgs.push(
              /^CWD [\S\s]+: Error: ENOENT/,
            );
            client.raw('CWD', dirRfcQuoted, (error) => {
              common.should.exist(error);
              error.code.should.equal(550);
              nxt();
            });
          },
          function strangePathCwd(nxt) {
            client.raw('CWD', dirPath, nxt);
          },
          function checkResponse(response, nxt) {
            response.code.should.equal(250);
            if (response.code !== 250) {
              return nxt(new Error('failed to CWD to unusual path'));
            }
            nxt();
          },
          function strangePathRetr(nxt) {
            const filename = `${trickyName}.txt`;
            client.get(filename, nxt);
          },
          receiveAndCompare,
          function strangePathRetr(nxt) {
            const filename = `cool-glasses.${coolGlasses}.txt`;
            client.get(filename, nxt);
          },
          receiveAndCompare,
        ], (error) => {
          common.should.not.exist(error);
          done();
        });
      });

      afterEach(() => {
        server.close();
      });
    });
  });
});
