const angular = window.angular
const littb = angular.module("littbApp")

class SlaOmtexternaCtrl {
    static $inject = ["$routeParams"]

    constructor($routeParams) {
        this.$routeParams = $routeParams
    }

    $onInit() {
        const docPath = "/red/sla/omtexterna/"
        this.doc = docPath + (this.$routeParams["doc"] || "omtexterna.html")
    }
}

littb.component("slaOmtexterna", {
    template: `<div ng-include="$ctrl.doc"></div>`,
    controller: SlaOmtexternaCtrl
})
