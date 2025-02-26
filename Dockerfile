# Используем официальный образ Node.js
FROM node:22 AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

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
COPY --from=builder /app/dist /usr/share/nginx/html

# Устанавливаем права доступа для файлов
RUN chmod -R 755 /usr/share/nginx/html

# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Экспортируем порт 80 и 443
EXPOSE 80 443

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
