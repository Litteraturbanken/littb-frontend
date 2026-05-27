const angular = window.angular
const _ = window._
const $ = window.$
const isDev = window.isDev
const c = typeof console !== "undefined" && console !== null ? console : { log: _.noop }
const littb = angular.module("littbApp")

function sortObjectKeys(obj) {
    let simpleKeys = []
    let complexKeys = []
    for (let key in obj) {
        if (
            typeof obj[key] === "string" ||
            typeof obj[key] === "number" ||
            typeof obj[key] === "boolean"
        ) {
            simpleKeys.push(key)
        } else {
            complexKeys.push(key)
        }
    }
    simpleKeys.sort()
    complexKeys.sort()
    let sortedObj = {}
    for (let key of simpleKeys.concat(complexKeys)) {
        sortedObj[key] = obj[key]
    }
    return sortedObj
}

class AutocompleteGlobalCtrl {
    static $inject = ["$scope", "backend", "$route", "$location", "$window", "$timeout", "$uibModal", "$http"]

    constructor($scope, backend, $route, $location, $window, $timeout, $uibModal, $http) {
        this.$scope = $scope
        this.backend = backend
        this.$route = $route
        this.$location = $location
        this.$window = $window
        this.$timeout = $timeout
        this.$uibModal = $uibModal
        this.$http = $http
    }

    $onInit() {
        const s = this.$scope
        let prevFilter = null

        const clearCommandOutput = () => {
            s.lbworkid = null
            s.info = null
            s.htmlInfo = null
        }

        s.close = () => {
            clearCommandOutput()
            s.$broadcast("blur")
            s.completeObj = null
            c.log("close modal", s.modal, s)
            if (s.modal != null) {
                s.modal.close()
            }
            s.modal = null
        }

        s.onSelect = (val) => {
            c.log("scope", s)
            if (!isDev) {
                this.backend.logQuicksearch(prevFilter, val.label)
            }
            if (val.action && val.action(s) === false) {
                return
            }
            s.close()
            if (val.url) {
                this.$location.url(val.url)
            }
        }

        const getReaderCtrl = () => {
            const readerElement = window.document.querySelector("reading")
            if (readerElement) {
                const readerScope =
                    angular.element(readerElement).isolateScope() ||
                    angular.element(readerElement).scope()
                if (readerScope) {
                    return readerScope.$ctrl || readerScope
                }
            }

            const readerMainScope = $(".reader_main").scope && $(".reader_main").scope()
            if (readerMainScope) {
                return readerMainScope.$ctrl || readerMainScope
            }
        }

        const getAuthorInfo = () => {
            const authorElement = window.document.querySelector("author-info-page")
            if (authorElement) {
                const authorScope =
                    angular.element(authorElement).isolateScope() ||
                    angular.element(authorElement).scope()
                if (authorScope) {
                    return authorScope.authorInfo || authorScope.$ctrl?.authorInfo
                }
            }

            const mainViewScope = $("#mainview").scope && $("#mainview").scope()
            return mainViewScope?.authorInfo
        }

        const getInfo = () => {
            if (this.$route.current.$$route.isReader) {
                return getReaderCtrl()?.workinfo
            }

            return getAuthorInfo()
        }

        const infoAction = () => {
            const info = getInfo()
            clearCommandOutput()
            if (!info) return

            let obj = { ...info }
            delete obj["filenameMap"]
            delete obj["content_vector"]
            s.info = JSON.stringify(sortObjectKeys(obj), null, 2)
        }

        s.autocomplete = (val) => {
            if (val) {
                prevFilter = val
                clearCommandOutput()
                let menu = [
                    { label: "Start", url: "/", typeLabel: "Gå till sidan" },
                    { label: "Bibliotek", url: "/bibliotek", typeLabel: "Gå till sidan" },
                    { label: "Epub", url: "/epub", typeLabel: "Gå till sidan" },
                    { label: "Ljud och bild", url: "/ljudochbild", typeLabel: "Gå till sidan" },
                    { label: "Sök", url: "/sok", alt: ["Sok"], typeLabel: "Gå till sidan" },
                    { label: "Presentationer", url: "/presentationer", typeLabel: "Gå till sidan" },
                    { label: "Dramawebben", url: "/dramawebben", typeLabel: "Gå till sidan" },
                    { label: "Nytillkommet", url: "/bibliotek?sort=nytillkommet", typeLabel: "Gå till sidan" },
                    { label: "Skolan", url: "/skolan", typeLabel: "Gå till sidan" },
                    { label: "Skolan/lyrik", url: "/skolan/lyrik", typeLabel: "Gå till sidan" },
                    { label: "Om", url: "/om/ide", typeLabel: "Gå till sidan" },
                    { label: "Hjälp", url: "/om/hjalp", alt: ["hjalp"], typeLabel: "Gå till sidan" },
                    { label: "Kontakt", url: "/om/kontakt", typeLabel: "Gå till sidan" },
                    { label: "Statistik", url: "/om/statistik", typeLabel: "Gå till sidan" },
                    { label: "Läshistorik", url: "/historik", typeLabel: "Gå till sidan" }
                ]

                if (this.$route.current.$$route.isReader) {
                    pushIfRed({
                        label: "/id",
                        alt: ["id", "red"],
                        typeLabel: "[Red.]",
                        action() {
                            clearCommandOutput()
                            const readerCtrl = getReaderCtrl()
                            if (readerCtrl?.workinfo) {
                                s.lbworkid = readerCtrl.workinfo.lbworkid
                                navigator.clipboard.writeText(s.lbworkid)
                            }
                            return false
                        }
                    })

                    pushIfRed({
                        label: "/editor",
                        alt: ["editor", "red"],
                        typeLabel: "[Red.]",
                        action() {
                            const readerCtrl = getReaderCtrl()
                            if (!readerCtrl?.workinfo) {
                                return false
                            }
                            let lbworkid = readerCtrl.editorLbWorkId || readerCtrl.workinfo.lbworkid
                            let ix = readerCtrl.pageix
                            let mediatype = readerCtrl.mediatype[0]
                            window.location.pathname = `/editor/${lbworkid}/ix/${ix}/${mediatype}`
                            return false
                        }
                    })
                }

                function pushIfRed(obj) {
                    if (isDev) {
                        menu.push(obj)
                    }
                }

                if (
                    this.$route.current.$$route.isReader ||
                    this.$route.current.$$route.pageId === "authorInfo" ||
                    this.$route.current.$$route.controller == "authorInfoCtrl"
                ) {
                    pushIfRed({
                        label: "/info",
                        alt: ["info", "db", "red"],
                        typeLabel: "[Red.]",
                        action() {
                            infoAction()
                            return false
                        }
                    })
                }

                if (val.match(/^lb.*/)) {
                    menu.push({
                        label: val,
                        url: `/editor/${val}/ix/0/f`,
                        typeLabel: "[Red.] Gå till faksimileditorn"
                    })
                    menu.push({
                        label: val,
                        typeLabel: "[Red.] Sök i ftp",
                        action: () => {
                            clearCommandOutput()
                            this.$http({
                                url: `https://red.litteraturbanken.se/hitta?q=${val}`
                            }).then(
                                response => {
                                    console.log("response", response.data)
                                    s.htmlInfo = response.data.split("\n").map(url => {
                                        url = url.replace(/\/mnt/, "//mnt")
                                        let breadcrumbs = url
                                            .split("/")
                                            .slice(5)
                                            .map((part, index) => ({
                                                label: part,
                                                url: url
                                                    .split("/")
                                                    .slice(0, index + 6)
                                                    .join("/")
                                            }))
                                            .slice(0, -1)
                                        return { url, breadcrumbs }
                                    })
                                },
                                response => {
                                    console.log("response", response)
                                    s.$emit("notify", "Hittade inte red-tjänsten.")
                                }
                            )
                            return false
                        }
                    })
                }

                menu = _.filter(menu, (item) => {
                    const exp = new RegExp(`^${val}`, "gi")
                    return (
                        item.label.match(exp) ||
                        (item.alt && _.some(item.alt.map(item => item.match(exp))))
                    )
                })

                if (val.charAt(0) === "/") {
                    return menu
                }

                return this.backend.autocomplete(val).then((data) => {
                    console.log("data", data, val, s)
                    return data.concat(menu)
                })
            }
        }

        const show = () => {
            clearCommandOutput()
            s.modal = this.$uibModal.open({
                templateUrl: "autocomplete.html",
                scope: s,
                windowClass: "autocomplete",
                size: "sm"
            })
            return this.$timeout(() => s.$broadcast("focus"), 0)
        }

        s.$on("show_autocomplete", () => show())

        const onKeydown = (event) => {
            switch (event.key) {
                case "Escape":
                    s.$apply(() => s.close())
                    break
                case "s":
                    if (!$("input:focus,textarea:focus,select:focus").length) {
                        s.$apply(() => show())
                    }
                    break
                case "F20":
                case "\u0131":
                case "\u012B":
                    if (!$("input:focus,textarea:focus,select:focus").length) {
                        s.$apply(() => {
                            show()
                            infoAction()
                        })
                    }
                    break
            }
        }

        $(this.$window).on("keydown.autocomplete", onKeydown)
        s.$on("$destroy", () => $(this.$window).off("keydown.autocomplete", onKeydown))
    }
}

littb.component("autocompleteGlobal", {
    template: "",
    controller: AutocompleteGlobalCtrl
})
