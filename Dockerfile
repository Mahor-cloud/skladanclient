# Используем официальный образ Node.js
FROM node:22 AS builder

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN yarn install

# Копируем остальные файлы
COPY . .

# Собираем приложение
RUN yarn build

FROM nginx:stable-alpine as production-stage
# Copy the build application from the previous stage to the Nginx container
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
# Copy the nginx configuration file
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose the port 80
EXPOSE 80
# Start Nginx to serve the application
CMD ["nginx", "-g", "daemon off;"]

