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

# Копируем собранные файлы в Nginx
COPY --from=0 /usr/src/app/dist /usr/share/nginx/html

# Экспортируем порт 80
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
