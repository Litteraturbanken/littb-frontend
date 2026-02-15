import controller from "./reading_controller"

import template from "@/views/reader.html?raw"
import "./reader.scss"

export default angular.module("readingModule", []).component("reading", {
    // templateUrl: require("../views/reader.html"),
    template,
    controller
}).name
