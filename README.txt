Year 4 AI Game Maker

This version uses AI to generate structured game content (JSON), then renders the playable game with a fixed, tested game engine. This avoids JavaScript syntax errors in AI-generated HTML while keeping AI generation.

Deploy as a static GitHub Pages site. AI generation uses the anonymous/free Pollinations endpoint and may be rate-limited. Do not enter personal student information.


Robust game renderer update: game data is base64-encoded before entering the iframe, preventing AI-generated text from breaking the script. Share has a clipboard fallback.
