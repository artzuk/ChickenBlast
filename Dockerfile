# Chicken Blast - static site behind nginx. No build step: the game is plain HTML/JS.
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html core.js worlds.js game.js sw.js manifest.webmanifest /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/
COPY icons/ /usr/share/nginx/html/icons/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
