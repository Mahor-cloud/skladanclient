# Используем официальный образ Node.js для сборки
FROM node:22 AS build-stage

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN yarn install

# Копируем исходный код
COPY . .

# Удаляем папки dist и .vite (если они существуют)
RUN rm -rf dist .vite

# Собираем проект
RUN yarn build

# Используем официальный образ Nginx для production
FROM nginx:alpine AS production-stage

# Копируем собранные файлы из стадии сборки в Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 80
EXPOSE 80 443

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
