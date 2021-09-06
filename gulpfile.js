const { src, dest, watch, parallel, series } = require('gulp');

const scss            = require('gulp-sass')(require('sass'));
const concat          = require('gulp-concat');
const browserSync     = require('browser-sync').create();
const ssi             = require('browsersync-ssi'); //подключаем модуль в gulpfile.js что раб компонент
const buildssi        = require('gulp-ssi');
const uglify          = require('gulp-uglify-es').default;
const autoprefixer    = require('gulp-autoprefixer');
const imagemin        = require('gulp-imagemin');
const rename          = require('gulp-rename');
const nunjucksRender  = require('gulp-nunjucks-render');
// const babel = require("gulp-babel");  //переводит ES6 в старый обычный JS
// В gulpfile объявляем плагины:
const replace         = require('gulp-replace'); //фиксинг некоторых багов, Однако у данного плагина один баг - иногда он преобразовывает символ ‘>’ в кодировку '&gt;'
const cheerio         = require('gulp-cheerio');// удаление лишних атрибутов из svg
const sprite          = require('gulp-svg-sprite');// создание спрайта
const del             = require('del');

 // компоненты. доработываем функцию browsersync()
function browsersync() {
  browserSync.init({
    server: {
      baseDir: "app/", //следит за проектом(конкретно за папкой app)
      middleware: ssi({ baseDir: 'app/', ext: '.html' }), // отвечает за подключение SSI к Browsersync.
    },
    // tunnel: 'gulp_my_start', //Параметр tunnel отвечает за формирования внешнего URL вашего проекта. Это может быть полезно в том случае, если необходимо 
    //продемонстрировать проект кому-либо ещё, кто не находится в вашей локальной сети. Адрес https://yousutename.loca.lt будет доступен в любом месте, где 
    //бы не находился посетитель, данные берутся с вашего локального сервера Browsersync в реальном времени. В качестве значения д/параметра tunnel: желательно
    // указывать что-то уникальное, чтобы адрес был сформирован без ошибок и не пересекался с адресами других пользователей
  }); 
}

function cleanDist() {
  return del('dist');
}

function images() {
  return src('app/images/**/*')
    .pipe(imagemin([
      imagemin.gifsicle({ interlaced: true }),
      imagemin.mozjpeg({ quality: 75, progressive: true }),
      imagemin.optipng({ optimizationLevel: 5 }),
      imagemin.svgo({
        plugins: [
          { removeViewBox: true },
          { cleanupIDs: false }
        ]
      })
    ]))
    .pipe(dest('dist/images')); //перед сдачей проекта сжать картинки ручками

}

//Создаем svg-файл
function svgSprite() {
  return src('app/images/sprite/*.svg') //Говорим откуда нам нужно взять иконки
  //Удаляем атрибуты style, fill и stroke из иконок, для того чтобы они не перебивали стили, заданные через css.
    .pipe(cheerio({
      run: function ($) {
        $('[fill]').removeAttr('fill');
        $('[stroke]').removeAttr('stroke');
        $('[style]').removeAttr('style');
      },
      parserOptions: {
        xmlMode: true
      }
    }))
    // у плагина один баг - иногда он преобразовывает символ ‘>’ в кодировку '&gt;'
    //Эту проблему решает следующий кусок таска:
    .pipe(replace('&gt;', '>'))

    //Теперь сделаем из получившегося спрайт и положим в папку:
    .pipe(sprite({
      mode: {
        stack: {
          //все свг будут слаживаться в 1 файл
          sprite: '../sprite.svg'
        }
      }
    }))
    //закидываем готовый результат в папку images
    .pipe(dest('app/images'));
}

function scripts() {
  return src([
    'node_modules/jquery/dist/jquery.js',
    'node_modules/slick-carousel/slick/slick.js',
    'node_modules/@fancyapps/fancybox/dist/jquery.fancybox.js',
    'node_modules/rateyo/src/jquery.rateyo.js',
    'node_modules/ion-rangeslider/js/ion.rangeSlider.js',
    'node_modules/jquery-form-styler/dist/jquery.formstyler.js',
    'app/js/main.js'
  ])
    .pipe(concat('main.min.js')) //переименовывает
    // .pipe(babel({  //бабель переводит в обычный js
    //   presets: ['@babel/preset-env']
    // }))
    .pipe(uglify()) //сжатие
    .pipe(dest('app/js')) //добавляем в папку джс
    .pipe(browserSync.stream()); //обновляет страницу

}

function nunjucks() {
  return src('app/*.njk')
    .pipe(nunjucksRender())
    .pipe(dest('app'))
    .pipe(browserSync.stream())
}

function styles() {
  return src([
      // 'node_modules/slick-carousel/slick/slick.scss',
      // 'node_modules/rateyo/src/jquery.rateyo.css',
      // 'node_modules/ion-rangeslider/css/ion.rangeSlider.css',
      // 'node_modules/jquery-form-styler/dist/jquery.formstyler.css',
      'app/scss/*.scss'
      ])
    .pipe(scss({ outputStyle: 'compressed' })) //сжимает файл expanded  не сжатый
    // .pipe(concat()) //переименовывает файлы 
    .pipe(rename({
      suffix : '.min'
    }))
    .pipe(autoprefixer({
      overrideBrowserslist: ['last 10 version'],
      grid: true
    }))
    .pipe(dest('app/css'))
    .pipe(browserSync.stream()); //обновляет страницу
}


function css() {
  return src([
    'node_modules/normalize.css/normalize.css',
  ])
    .pipe(concat('_libs.scss'))
    .pipe(dest('app/scss'))
    .pipe(browserSync.stream());
}


function build() {
  return src([
    'app/css/style.min.css',
    'app/fonts/**/*',
    'app/js/main.min.js',
    'app/*.html'
  ], { base: 'app' })
    .pipe(dest('dist'));
}

function buildhtml() {
  return src(['app/**/*.html', '!app/components/**/*'])
    .pipe(buildssi({ root: 'app' }))
    .pipe(dest('dist'));
}

function watching() {
  watch(['app/**/*.scss'], styles); //следит за папкой scss(вложеные папки)
  watch(['app/js/main.js', '!app/js/main.min.js'], scripts);
  watch(['app/*.njk'], nunjucks);
  watch(['app/**/*.html']).on('change', browserSync.reload);
  watch(['app/images/sprite/*.svg'], svgSprite); //следим за спрайтами - указываем путь
}

exports.styles      = styles;
exports.watching    = watching;
exports.browsersync = browsersync;
exports.scripts     = scripts;
exports.images      = images;
exports.nunjucks    = nunjucks;
exports.cleanDist   = cleanDist;
exports.svgSprite   = svgSprite; //экспортируем


exports.build = series(cleanDist, images, build, buildhtml);


exports.default = parallel(nunjucks, css, styles, scripts, svgSprite, browsersync, watching);