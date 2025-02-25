# Используем официальный образ Node.js
FROM node:22

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN yarn install

# Копируем остальные файлы
COPY . .

# Собираем проект
RUN yarn build

# Используем официальный образ Nginx
FROM nginx:alpine

# Копируем собранные файлы Vue.js в директорию Nginx
COPY dist /usr/share/nginx/html

# Устанавливаем правильные права доступа
RUN chmod -R 755 /usr/share/nginx/html

# Копируем конфигурационный файл Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Экспортируем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
