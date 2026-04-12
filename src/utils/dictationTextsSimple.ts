// src/utils/dictationTextsSimple.ts

export const dictationTextsSimple = {
  'ru-RU': {
    'easy': `Дом
Школа
Работа
Друг
Город
Страна
Еда
Напиток
Время
Погода`, // ✅ Заменяем на столбик слов
    'medium': 'На прошлой неделе было чудесно. В субботу мы с отцом пошли в парк. Небо было голубым, а птицы пели.',
    'hard': 'Я учу английский язык уже три года. Мне нравится изучать новые слова и фразы.',
  },
  'en-US': {
    'easy': 'I love summer. The weather is warm and sunny. We like to walk in the park and play football.',
    'medium': 'Last weekend was wonderful. On Saturday, my father and I went to the park. The sky was blue, and the birds were singing.',
    'hard': 'I have been learning English for three years. I enjoy learning new words and phrases.',
  },
  'es-ES': {
    'easy': 'Me encanta el verano. El clima es cálido y soleado. Nos gusta pasear por el parque y jugar al fútbol.',
    'medium': 'El fin de semana pasado fue maravilloso. El sábado, mi padre y yo fuimos al parque. El cielo estaba azul y los pájaros cantaban.',
    'hard': 'Estoy aprendiendo inglés desde hace tres años. Me gusta aprender nuevas palabras y frases.',
  },
  'fr-FR': {
    'easy': 'J’adore l’été. Le temps est chaud et ensoleillé. Nous aimons nous promener dans le parc et jouer au football.',
    'medium': 'Le week-end dernier était merveilleux. Samedi, mon père et moi sommes allés au parc. Le ciel était bleu et les oiseaux chantaient.',
    'hard': 'J’apprends l’anglais depuis trois ans. J’aime apprendre de nouveaux mots et expressions.',
  },
  'de-DE': {
    'easy': 'Ich liebe den Sommer. Das Wetter ist warm und sonnig. Wir gehen gerne im Park spazieren und spielen Fußball.',
    'medium': 'Letztes Wochenende war wunderbar. Am Samstag sind mein Vater und ich in den Park gegangen. Der Himmel war blau und die Vögel sangen.',
    'hard': 'Ich lerne seit drei Jahren Englisch. Mir macht es Spaß, neue Wörter und Phrasen zu lernen.',
  },
  'kk-KZ': {
    'easy': 'Мен жазды өте жақсы көремін. Ауа-райы жылы және күннің көрінісі. Біз паркте жүріп, футбол ойнаймыз.',
    'medium': 'Өткен жұма күні ғажайып болды. Сенбі күні әкем мен мен паркке бардық. Аспан көк болды, құстар ән шырқады.',
    'hard': 'Мен үш жыл бойы ағылшын тілін үйреніп келемін. Мен жаңа сөздер мен сөйлемдерді үйренуді ұнатамын.',
  },
};

export type Language = keyof typeof dictationTextsSimple;
export type Difficulty = 'easy' | 'medium' | 'hard';