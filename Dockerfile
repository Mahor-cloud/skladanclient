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

# Используем официальный образ Nginx
FROM nginx:alpine

# Копируем собранные файлы Vue в директорию Nginx
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Экспортируем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
