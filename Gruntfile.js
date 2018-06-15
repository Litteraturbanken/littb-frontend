// 'use strict';
var LIVERELOAD_PORT = 35729;
var lrSnippet = require('connect-livereload')({ port: LIVERELOAD_PORT });
var proxySnippet = require('grunt-connect-proxy/lib/utils').proxyRequest;
var modRewrite = require('connect-modrewrite');
var mountFolder = function (connect, dir) {
  return connect.static(require('path').resolve(dir));
};


var host = 'demolittb.spraakdata.gu.se'
// var host = 'litteraturbanken.se'


// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'


module.exports = function (grunt) {
  require('load-grunt-tasks')(grunt);
  require('time-grunt')(grunt);

  // configurable paths
  var yeomanConfig = {
    app: 'app',
    dist: 'dist'
  };

  try {
      yeomanConfig.app = require('./bower.json').appPath || yeomanConfig.app;
    } catch (e) {}

  grunt.initConfig({
    yeoman: yeomanConfig,
    watch: {
      coffee: {
        files: ['<%= yeoman.app %>/scripts/{,*/}*.coffee'],
        tasks: ['newer:coffee:dist']
      },
      coffeeTest: {
        files: ['test/spec/{,*/}*.coffee'],
        tasks: ['newer:coffee:test']
      },
      // compass: {
      //   files: ['<%= yeoman.app %>/styles/{,*/}*.{scss,sass}'],
      //   tasks: ['compass:server', 'newer:autoprefixer'],
      // },

      sass: {
          files: ['<%= yeoman.app %>/styles/{,*/}*.{scss,sass}'],
          tasks: ["sass:dist"]
      },

      gruntfile: {
        files: ['Gruntfile.js']
      },
      css: {
        options: {
          livereload: LIVERELOAD_PORT
        },
        files: [
          '{.tmp,<%= yeoman.app %>}/styles/{,*/}*.css'
        ],
        tasks: []
      },
      livereload: {
        options: {
          livereload: LIVERELOAD_PORT
        },
        files: [
          '<%= yeoman.app %>/index.html',
          '<%= yeoman.app %>/views/{,*/}*.html',
          //'{.tmp,<%= yeoman.app %>}/styles/styles.css', // keep css watch in separate reload so we dont reload whole page on css change
          '{.tmp,<%= yeoman.app %>}/scripts/{,*/}*.js',
          '<%= yeoman.app %>/img/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
        ]
      }
    },
    autoprefixer: {
      options: ['last 1 version'],
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/styles/',
          src: '{,*/}*.css',
          dest: '<%= yeoman.app %>/styles/'
        }]
      }
    },

    protractor: {
      options: {
        // configFile: "node_modules/protractor/example/conf.js", // Default config file. overwritten below.
        keepAlive: false, // If false, the grunt process stops when the test fails.
        noColor: false, // If true, protractor will not use colors in its output.
        chromeOnly : true,
        args: {
          // Arguments passed to the command
        }
      },
      test: {
        options: {
          configFile: "test/e2e/conf_e2e.js", // Target-specific config file
          args: {} // Target-specific arguments
        }
      }
    },

    protractor_webdriver: {
      test : {
        options: {
            path: 'node_modules/protractor/bin/',
            command: './webdriver-manager start',
          },
      }
    },

    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: '0.0.0.0',
      },
      proxies : [
      // {
      //     context: '/api',
      //     host: host,
      //     port: 443,
      //     https: true,
      //     changeOrigin: true

      // }
      {
          context: '/api',
          host: host,
          port: 80,
          https: false,
          changeOrigin: true

      },
      {
          context: '/översättarlexikon',
          host: host,
          port: 80,
          https: false,
          changeOrigin: true

      }
      ].concat(["red", "txt", "query", "bilder", "css", "sla-bibliografi", "authordb", "xhr", "ws", "so"].map(function(item) {
        
        return {
                      context: '/' + item,
                      host: host,
                      port: 80,
                      https: false,
                      changeOrigin: true

                  }
      })),
      // proxies : [
      //   {
      //     // context: '/' + item,
      //     context: ["red", "txt", "query", "bilder", "css", "sla-bibliografi", "authordb", "ws"],
      //     host: 'demolittb.spraakdata.gu.se',
      //     port: 80,
      //     https: false,
      //     changeOrigin: true

      //   }
      // ],
      livereload: {
          options: {
              middleware: function (connect) {
                  return [
                      lrSnippet,
                      proxySnippet,
                      modRewrite(['^[^\\.]*$ /index.html [L]']),
                      mountFolder(connect, '.tmp'),
                      mountFolder(connect, yeomanConfig.app)
                  ];
              }
          }
      },
      test: {
        options: {
          middleware: function (connect) {
            return [
              proxySnippet, 
              modRewrite(['^[^\\.]*$ /index.html [L]']),
              mountFolder(connect, '.tmp'),
              mountFolder(connect, 'test')
            ];
          }
        }
      },
      e2e : {
        options: {
          port: 9001,
          middleware: function (connect) {
            return [
              proxySnippet, 
              modRewrite(['^[^\\.]*$ /index.html [L]']),
              mountFolder(connect, '.tmp'),
              mountFolder(connect, yeomanConfig.app)
            ];
          }
        }
      },
      dist: {
          options: {
              middleware: function (connect) {
                  return [
                    proxySnippet,
                    modRewrite(['^[^\\.]*$ /index.html [L]']),

                    mountFolder(connect, yeomanConfig.dist)
                  ];
              }
          }
      }
    },
    clean: {
      dist: {
        options : {
          force : true
        },
        files: [{
          dot: true,
          src: [
            '.tmp',
            '<%= yeoman.dist %>',
            '!<%= yeoman.dist %>/.git*'
          ]
        }]
      },
      server: {
        options : {
          force : true
        },
        files: [{
          src: ['.tmp']
        }]
      } 
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        '<%= yeoman.app %>/scripts/{,*/}*.js'
      ]
    },
    // Automatically inject Bower components into the app
    wiredep: {
      dist: {
        src: ['<%= yeoman.app %>/index.html'],
        ignorePath:  /\.\.\//,
        exclude : [
          "<%= yeoman.app %>/components/sass-bootstrap", 
          "<%= yeoman.app %>/components/angular-cache",
          "<%= yeoman.app %>/components/angular-ui-utils"
        ]
      },
      // sass: {
      //   src: ['<%= yeoman.app %>/styles/{,*/}*.{scss,sass}'],
      //   ignorePath: /(\.\.\/){1,2}components\//
      // }
    },
    coffee: {
      options : {
        sourceMap: true,
        sourceRoot: '..'
      },
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/scripts',
          src: ['**/*.coffee'],
          dest: '<%= yeoman.app %>/scripts/bin',
          ext: '.js'
        }]
      },
      test: {
        files: [{
          expand: true,
          cwd: 'test/spec',
          src: '*.coffee',
          dest: 'test/spec',
          ext: '.js'
        },
        {
          expand: true,
          cwd: 'test/e2e',
          src: '*.coffee',
          dest: 'test/e2e',
          ext: '.js'
        }]
      }
    },
    // compass: {
    //   options: {
    //     sassDir: '<%= yeoman.app %>/styles',
    //     cssDir: ['.tmp/styles'],
    //     generatedImagesDir: '.tmp/img/generated',
    //     imagesDir: '<%= yeoman.app %>/img',
    //     javascriptsDir: '<%= yeoman.app %>/scripts',
    //     fontsDir: '<%= yeoman.app %>/styles/fonts',
    //     importPath: '<%= yeoman.app %>/components',
    //     httpImagesPath: '/img',
    //     httpGeneratedImagesPath: '/img/generated',
    //     httpFontsPath: '/styles/fonts',
    //     relativeAssets: false
    //   },
    //   dist: {
    //     options: {
    //       outputStyle: 'compressed',
    //       force: true
    //     }
    //   },
    //   server: {
    //     options: {
    //       debugInfo: true
    //     }
    //   }
    // },
    sass: {
      options: {
          sourceMap: true
      },
      dist: {
          // src: ['<%= yeoman.app %>/styles/{,*/}*.{scss,sass}'],
          files: [{
            expand: true,
            cwd: '<%= yeoman.app %>/styles',
            src: ['**/*.scss'],
            dest: '.tmp/styles',
            ext: '.css'
          }]

      }
    },
    filerev: {
      dist: {
        src: [
          '<%= yeoman.dist %>/scripts/{,*/}*.js',
          '<%= yeoman.dist %>/styles/{,*/}*.css',
          '<%= yeoman.dist %>/img/{,*/}*.{png,jpg,jpeg,gif,webp}',
          '!<%= yeoman.dist %>/img/favicons/**'
          // '!<%= yeoman.dist %>/img/focus_letters.svg',
          // '<%= yeoman.dist %>/styles/fonts/*'
        ]
          
      }
    },
    useminPrepare: {
      html: '<%= yeoman.app %>/index.html',
      options: {
        dest: '<%= yeoman.dist %>',
        flow: {
          html: {
            steps: {
              js: ['concat', 'uglifyjs'],
              css: ['cssmin']
            },
            post: {}
          }
        }
      }
    },
    usemin: {
      html: [
        '<%= yeoman.dist %>/{,*/}*.html',
        '<%= yeoman.dist %>/views/**/*.html'
      ],
      css: ['<%= yeoman.dist %>/styles/{,*/}*.css'],
      options: {
        assetsDirs: ['<%= yeoman.dist %>', '<%= yeoman.dist %>/img']
      }
    },
    imagemin: {
      dist: {
        options: {
          optimizationLevel: 1, // could optimize pngs more (up to 7) for slightly smaller size, but can be very slow with bigger files. Or use a cache + grunt-newer
        },
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/img',
          src: '{,*/}*.{png,jpg,jpeg}',
          dest: '<%= yeoman.dist %>/img'
        },
        {

        }]
      }
    },
    svgmin: {
      dist: {
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>/img',
          src: '{,*/}*.svg',
          dest: '<%= yeoman.dist %>/img'
        }]
      }
    },
    // cssmin: {
      // dist: {
      //   files: {
      //     '<%= yeoman.dist %>/styles/main.css': [
      //       '.tmp/styles/{,*/}*.css',
      //       '<%= yeoman.app %>/styles/{,*/}*.css'
      //     ]
      //   }
      // }
    // },
    htmlmin: {
      dist: {
        options: {
          /*removeCommentsFromCDATA: true,
          // https://github.com/yeoman/grunt-usemin/issues/44
          //collapseWhitespace: true,
          collapseBooleanAttributes: true,
          removeAttributeQuotes: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeOptionalTags: true*/
        },
        files: [{
          expand: true,
          cwd: '<%= yeoman.app %>',
          src: ['*.html', 'views/{,*/}*.html'],
          dest: '<%= yeoman.dist %>'
        }]
      }
    },
    copy: {
      dist: {
        files: [
        {
          expand: true,
          cwd: '<%= yeoman.app %>',
          src: ['components/font-awesome/fonts/*'],
          // dest: '<%= yeoman.dist %>/fonts',
          dest: '<%= yeoman.dist %>/components/font-awesome/fonts/',
          flatten: true
        },
        {
          expand: true,
          cwd: '<%= yeoman.app %>',
          src: ['styles/requiem/*'],
          dest: '<%= yeoman.dist %>/styles/requiem',
          flatten: true
        },
        {
          expand: true,
          dot: true,
          cwd: '<%= yeoman.app %>',
          dest: '<%= yeoman.dist %>',
          src: [
            '*.{ico,png,txt}',
            '.htaccess',
            'robots.txt',
            // 'bower_components/**/*',
            'img/{,*/}*',
            'styles/fonts/**/*',
            'components/select2/select2.css',
            'components/select2/select2.png',
            'components/font-awesome/css/font-awesome.css'
          ]
        }, {
          expand: true,
          cwd: '.tmp/img',
          dest: '<%= yeoman.dist %>/img',
          src: [
            'generated/*'
          ]
        }, 
        { // xml-filer för kollationeringen
            expand : true,
            cwd : '<%= yeoman.app %>',
            dest: '<%= yeoman.dist %>',
            src : ['views/sla/*.xml'],
        }
        // ,
        // { 
        //     expand : true,
        //     cwd : '<%= yeoman.app %>',
        //     dest: '<%= yeoman.tmp %>',
        //     src : ['components/select2/select2.css'],
        // }
        ]
      },
    },
    concurrent: {
      server: [
        'newer:coffee:dist',
        'sass',
        // 'compass:server',
      ],
      test: [
        'newer:coffee',
        'sass',
        // 'compass',
      ],
      dist: [
        'coffee',
        'sass',
        // 'compass:dist',
        'imagemin',
        'svgmin',
        'htmlmin'
      ]
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        singleRun: true
      }
      // e2e: {
      //   configFile: 'karma-e2e.conf.js'
      //   // singleRun: true
      // }

    },
    // cdnify: {
    //   dist: {
    //     html: ['<%= yeoman.dist %>/*.html']
    //   }
    // },
    // ngAnnotate: {
    //   dist: {
    //     files: [{
    //       expand: true,
    //       cwd: '<%= yeoman.dist %>/scripts',
    //       src: '*.js',
    //       dest: '<%= yeoman.dist %>/scripts'
    //     }]
    //   }
    // },

    ngAnnotate: {
      dist: {
        files: [{
          expand: true,
          cwd: '.tmp/concat/scripts',
          src: ['*.js', '!oldieshim.js'],
          dest: '.tmp/concat/scripts'
        }]
      }
    },

    uglify: {}, // generated by usemin
  });

  grunt.registerTask('server', function (target) {
      if (target === 'dist') {
          return grunt.task.run(['configureProxies', 'connect:dist:keepalive']);
      }

      grunt.task.run([
        'clean:server',
        'wiredep',
        'configureProxies',
        'concurrent:server',
        'autoprefixer',
        'connect:livereload',
        'watch'
      ]);
  });

  grunt.registerTask('quicke2e', [
    "coffee:test",
    'connect:e2e',
    'protractor'
  ]);
  grunt.registerTask('e2e', [
    "coffee:test",
    'connect:e2e',
    "protractor_webdriver",
    'protractor'
  ]);
  grunt.registerTask('test', [
    'clean:server',
    'configureProxies',
    'concurrent:test',
    'concurrent:server',
    'autoprefixer',
    // 'karma', // karma currenly not in use, e2e only
    'e2e'
    
  ]);
  grunt.registerTask('docker_test', [
    'clean:server',
    'configureProxies',
    'concurrent:test',
    'concurrent:server',
    'autoprefixer',
    'quicke2e'
  ]);


  grunt.registerTask('build', [
    // 'test',
    'clean:dist',
    'wiredep',
    'useminPrepare',
    'concurrent:dist',
    'autoprefixer',
    'concat',
    'copy:dist',
    'ngAnnotate',
    'cssmin',
    'uglify',
    'filerev',
    'usemin'
  ]);




  grunt.registerTask('default', ['build']);
};
