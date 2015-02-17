/// <reference path="typings/tsd.d.ts" />

import gulp = require("gulp");
import del = require("del");
import browserSync = require("browser-sync");

var $ = require("gulp-load-plugins")();
var runSequence = require("run-sequence");

class ErrorNotifier {
    public static getErrorListener(title: string): (error: Error) => void {
        return $.notify.onError((error: Error) => ({
            title: title,
            message: error.message.replace(/\u001b\[\d+m/g, "")
        }));
    }
}

class Tasks {
    [id: string]: gulp.ITaskCallback;

    private default(callback: (err: Error) => any): NodeJS.ReadWriteStream {
        return runSequence("styles", "lint", "build", ["html", "assets"], "minify", callback);
    }

    private clean(callback: (err: Error, deletedFiles: string[]) => any): void {
        del(["./dest/*", "./dev/*", "!./dest/.git"], { dot: true }, callback);
    }

    private build(): NodeJS.ReadWriteStream {
        return this.compile();
    }

    private compile(): NodeJS.ReadWriteStream {
        return gulp.src(["./src/ts/*.ts"])
                   .pipe($.sourcemaps.init())
                   .pipe($.typescript({
                       noEmitOnError: true,
                       noImplicitAny: true,
                       target: "ES5",
                       sortOutput: true
                   })).js
                   .on("error", ErrorNotifier.getErrorListener("TypeScript Compilation Error"))
                   .pipe($.sourcemaps.write("."))
                   .pipe(gulp.dest("./dev/js/"))
                   .pipe($.size());
    }

    private minify(): NodeJS.ReadWriteStream {
        return gulp.src(["./dev/js/*.js", "!./dev/js/*.min.js"])
                   .pipe($.uglify({ preserveComments: "some" }))
                   .pipe($.rename({ extname: ".min.js" }))
                   .pipe(gulp.dest("./dest/js/"))
                   .pipe($.size());
    }

    private html(): NodeJS.ReadWriteStream {
        var assets = $.useref.assets();
        return gulp.src(["./index.html"])
                   .pipe(assets)
                   .pipe($.if("*.js", $.uglify()))
                   .pipe($.if("*.css", $.csso()))
                   .pipe(assets.restore())
                   .pipe($.useref())
                   .pipe(gulp.dest("./dest/"))
                   .pipe($.size());
    }

    private styles(): NodeJS.ReadWriteStream {
        return gulp.src(["./src/scss/style.scss", "./lib/css/*.css", "!./lib/css/*.min.css"])
                   .pipe($.sass({
                       precision: 10
                   }))
                   .on("error", ErrorNotifier.getErrorListener("SCSS Compilation Error"))
                   .pipe(gulp.dest("dev/css"))
                   .pipe($.size({ title: "styles" }));
    }

    private copy(): NodeJS.ReadWriteStream {
        return gulp.src(["./favicon.ico", "CNAME"])
                   .pipe(gulp.dest("./dest/"))
                   .pipe($.size({ title: "copy" }));
    }

    private fonts(): NodeJS.ReadWriteStream {
        return gulp.src(["./bower_components/**/fonts/**"])
                   .pipe($.flatten())
                   .pipe(gulp.dest("./dev/fonts/"))
                   .pipe(gulp.dest("./dest/fonts/"))
                   .pipe($.size({ title: "fonts" }));
   }

    private images(): NodeJS.ReadWriteStream {
        return gulp.src(["./images/*"])
                   .pipe($.cache($.imagemin({
                       progressive: true,
                       interlaced: true
                   })))
                   .pipe(gulp.dest("./dest/images/"))
                   .pipe($.size());
    }

    private lint(): NodeJS.ReadWriteStream {
        return gulp.src("./src/ts/*.ts")
                   .pipe($.tslint())
                   .pipe($.tslint.report("verbose"));
    }

    private lint_noemit(): NodeJS.ReadWriteStream {
        return gulp.src("./src/ts/*.ts")
                   .pipe($.tslint())
                   .pipe($.tslint.report("verbose"), {
                       emitError: false
                   });
    }

    private bower(): NodeJS.ReadWriteStream {
        return $.bower({cmd:'update'})
    }

    private serve(): void {
        browserSync({
            notify: false,
            logPrefix: "WSK",
            server: ["."],
            files: ["index.html", "./dev/css/*.css", "./dev/js/*.js", "./images/**/*"]
        });
        gulp.watch(["./src/**/*.scss"], ["styles"]);
        gulp.watch(["./src/ts/*.ts"], ["build", "lint:noemit"]);
    }

    private serve_dest(): void {
        browserSync({
            notify: false,
            logPrefix: "WSK",
            server: "dest"
        });
    }

    public static register(): void {
        gulp.task("default", ["clean"], cb => runSequence("styles", "lint", "build", ["html", "assets"], "minify", cb));
        gulp.task("assets", ["copy", "images", "fonts"]);
        gulp.task("full", ["bower"], cb => runSequence("default", cb));

        var instance = new Tasks();
        for (var task in instance) {
            gulp.task((<string>task).replace("_", ":"), instance[task].bind(instance));
        }
    }
}

Tasks.register();
