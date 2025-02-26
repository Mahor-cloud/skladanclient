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

# Устанавливаем простой HTTP-сервер
RUN yarn global add http-server

# Копируем собранные файлы в рабочую директорию
COPY --from=0 /usr/src/app/dist /usr/src/app/dist

# Экспортируем порт 80
EXPOSE 80

# Запускаем сервер для обслуживания статического контента
CMD ["http-server", "-p", "80", "/usr/src/app/dist"]
