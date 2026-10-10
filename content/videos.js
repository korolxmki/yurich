/* РОЛИКИ ДЛЯ БЛОКА «ВИДЕО».
   Пустой список — на сайте одна заглушка по центру.

   Ролик описывается одним из двух способов.

   1) Свой файл — так быстрее и без чужих скриптов:
      { file: 'assets/video/montazh.mp4', ratio: '9/16',
        cover: 'assets/img/video/montazh.jpg', title: 'Монтаж кухни за день' }

   2) Чужой проигрыватель — YouTube, VK или Instagram:
      { embed: 'https://www.instagram.com/reel/XXXXXXXXXXX/embed/', ratio: '9/16',
        title: 'Последнее видео из Instagram' }

   ratio — пропорции: '9/16' для вертикальных рилсов, '16/9' для обычных.
   cover — обложка; без неё свой файл покажет первый кадр сам.            */
window.VIDEOS = [
  {
    // последний рилс из Instagram @urich_mebel
    embed: 'https://www.instagram.com/reel/DeHVq09t2tm/embed/',
    title: '',
  },
];
