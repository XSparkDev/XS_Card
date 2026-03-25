const express = require('express');
const { getPublicBaseUrl } = require('../utils/publicBaseUrl');

const router = express.Router();

/*
================================================================================
  !!!  WALLET iOS Safari landing (manual UX)  !!!
================================================================================
  Safari renders raw `.pkpass` as a blank/binary-looking page.

  This route intentionally:
  - returns HTML for a nicer Safari tab
  - attempts to open the real `.pkpass` in a separate tab
  - only shows the "Done" action after the user returns (visibilitychange)
================================================================================
*/

router.get('/wallet-passes-view/:userId/:cardIndex', async (req, res) => {
  const { userId, cardIndex } = req.params;
  const cardIndexNum = parseInt(cardIndex, 10);
  const shouldSkipImages = req.query.skipImages === 'true';

  if (!userId || isNaN(cardIndexNum) || cardIndexNum < 0) {
    return res.status(400).send({ message: 'Invalid userId or cardIndex' });
  }

  const base = getPublicBaseUrl(req);
  const pkpassUrl =
    `${base}/wallet-passes/${encodeURIComponent(userId)}/${cardIndexNum}.pkpass` +
    (shouldSkipImages ? '?skipImages=true' : '');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>XS Card Pass</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px;">
    <h2 style="margin: 0 0 12px 0;">Opening Apple Wallet…</h2>
    <p style="margin: 0 0 18px 0; color: #555;">
      When you’re done adding the pass, come back to this tab.
    </p>

    <div id="doneWrap" style="display:none;">
      <button id="doneBtn"
        style="display:inline-block; padding: 12px 16px; background:#111; color:white; border:0; border-radius:10px; font-size:16px;"
        onclick="window.close && window.close()">
        Done
      </button>
      <p style="margin-top: 14px; color:#666; font-size:12px;">
        If the tab can’t be closed, you can just switch back to the app.
      </p>
    </div>

    <noscript>
      <p style="color:#666; font-size:12px; margin-top: 18px;">
        JavaScript is required to open the pass.
      </p>
      <a href="${pkpassUrl}" style="display:inline-block; margin-top: 12px; padding: 12px 16px; background:#111; color:white; text-decoration:none; border-radius:10px;">
        Open in Wallet
      </a>
    </noscript>

    <a id="pkpassLink" href="${pkpassUrl}" target="_blank" style="display:none;"></a>

    <script>
      // Kick off the Wallet handoff without permanently navigating this tab.
      // We use visibilitychange to reveal the "Done" action only after the user returns.
      (function () {
        var link = document.getElementById('pkpassLink');
        // Try in a short timeout so the click originates from the initial user gesture.
        setTimeout(function () {
          if (link && link.click) link.click();
        }, 250);

        function revealDone() {
          var wrap = document.getElementById('doneWrap');
          if (wrap) wrap.style.display = 'block';
        }

        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            revealDone();
          }
        });
      })();
    </script>
  </body>
</html>`);
});

module.exports = router;

