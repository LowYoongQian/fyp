FROM nginx:alpine

# Copy compiled Flutter Web assets
COPY build/web /usr/share/nginx/html

# Copy Nginx configuration template
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

# Replace PORT_PLACEHOLDER with $PORT at runtime and start Nginx
CMD sh -c "sed -i 's/PORT_PLACEHOLDER/'\"${PORT:-80}\"'/g' /etc/nginx/conf.d/default.conf.template && cp /etc/nginx/conf.d/default.conf.template /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
