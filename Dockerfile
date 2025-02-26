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

# Копируем собранные файлы в рабочую директорию
COPY --from=0 /usr/src/app/dist /usr/share/nginx/html

# Экспортируем порт 80
EXPOSE 80

# Запускаем сервер для обслуживания статического контента
CMD ["http-server", "-p", "80", "/usr/share/nginx/html"]
