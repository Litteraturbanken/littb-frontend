window.c = console ? log : _.noop
littb = angular.module('littbApp')

window.detectIE = () ->
    ua = window.navigator.userAgent

    msie = ua.indexOf('MSIE ')
    if (msie > 0)
        # IE 10 or older => return version number
        return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10)
    

    trident = ua.indexOf('Trident/')
    if (trident > 0)
        # IE 11 => return version number
        rv = ua.indexOf('rv:')
        return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10)
    

    edge = ua.indexOf('Edge/')
    if (edge > 0)
       # Edge (IE 12+) => return version number
       return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10)
    

    # other browser
    return false



littb.filter "formatAuthors", (authors) ->
    (authorlist, authorsById, makeLink, noHTML) ->
        if not authorlist or not authorlist.length or not authorsById then return

        stringify = (auth) ->
            suffix = {
                editor : " <span class='authortype'>red.</span>"
                translator : " <span class='authortype'>övers.</span>"
                illustrator : " <span class='authortype'>ill.</span>"
                photographer : " <span class='authortype'>fotogr.</span>"
                # scholar : " (red.)"


            }[auth.type] or ""
            if noHTML then suffix = $(suffix).text()
            authorsById[auth.author_id].full_name + suffix
        
        linkify = (auth) ->
            $("<a>").attr "href", "/forfattare/#{auth.author_id}"
                .html stringify auth
                .outerHTML()

        if makeLink
            strings = _.map authorlist, linkify
        else
            strings = _.map authorlist, stringify
        

        firsts = strings[...-1]
        last = _.last strings


        if noHTML
            et = "&"
        else
            et = "<em style='font-family: Requiem'>&</em>"
        if firsts.length then return "#{firsts.join(', ')} #{et} #{last}"
        else return last
        


littb.filter "downloadMediatypes", () ->
    (obj) ->
        (x for x in (obj?.mediatypes or []) when x.downloadable)

littb.filter "readMediatypes", () ->
    read = ['etext', 'faksimil']
    (obj) ->
        (x for x in (obj?.mediatypes or []) when x.label in read)


        

c.time = angular.noop
c.timeEnd = angular.noop

littb.filter "authorYear", () ->
    (obj) ->
        unless obj then return
        isFalsy = (val) ->
            not val or (val == "0000")
        birth = obj.birth?.plain
        death = obj.death?.plain
        if (isFalsy birth) and (isFalsy death) then return ""
        if isFalsy death then return "f. #{birth}"
        if isFalsy birth then return "d. #{death}"
        return "#{birth}-#{death}"


littb.controller "startCtrl", ($scope, $location) ->

    $scope.gotoTitle = (query) ->
        unless query
            url = "/titlar"
        else
            url = "/titlar?filter=#{query}&selectedLetter=#{query[0].toUpperCase()}"

        $scope.goto url



littb.controller "contactFormCtrl", ($scope, backend, $timeout, $location) ->
    s = $scope

    fromSchool = $location.search().skola?
    isSOL = $location.search().sol?

    if isSOL
        s.message = "[Ang. Översättarlexikon]\n\n"

    s.showContact = false
    s.showNewsletter = false
    s.showError = false

    done = () ->
        $timeout( () ->
            s.showContact = false
            s.showNewsletter = false
        , 4000)

    err = () ->
        s.showError = true
        s.showContact = false
        s.showNewsletter = false

        $timeout( () ->
            s.showError = false
        , 4000)

    s.submitContactForm = () ->
        if fromSchool
            msg = "[skola] " + s.message
        else
            msg = s.message
        # svenskt oversattarlexikon?
        
        backend.submitContactForm(s.name, s.email, msg, isSOL).then( () ->
            s.showContact = true
            done()
        , err
        )
    s.subscribe = () ->
        msg = s.newsletterEmail + " vill bli tillagd på utskickslistan."
        backend.submitContactForm("Utskickslista", s.newsletterEmail, msg).then( () ->
            s.showNewsletter = true
            done()
        , err
        )


    

littb.controller "statsCtrl", ($scope, backend) ->
    s = $scope




    backend.getStats().then (data) ->
        s.statsData = data

    backend.getTitles(false, null, "popularity|desc").then (titleArray) ->
        s.titleList = titleArray

    backend.getEpub(30).then (titleArray) ->
        s.epubList = titleArray






littb.controller "biblinfoCtrl", ($scope, backend) ->
    s = $scope
    limit = true
    s.showHit = 0
    s.searching = false
    s.wf = ""

    s.showAll = () ->
        limit = false
    
    s.increment = () ->
        limit = true
        s.entries?[s.showHit + 1] and s.showHit++
    s.decrement = () ->
        limit = true
        s.showHit and s.showHit--

    s.getEntries = () ->
        if limit
            return [s.entries?[s.showHit]]
        else 
            s.entries

    s.getColumn1 = (entry) ->
        pairs = _.pairs entry
        splitAt = Math.floor pairs.length / 2
        _.object pairs[0..splitAt]

    s.getColumn2 = (entry) ->
        pairs = _.pairs entry
        splitAt = Math.floor pairs.length / 2
        _.object pairs[(splitAt + 1)..]
    
    s.submit = () ->
        names = ["manus", "tryckt_material", "annat_tryckt", "forskning"]
        params = ("resurs=" + x for x in names when s[x])
        wf = s.wf if wf
        s.searching = true

        backend.getBiblinfo(params.join("&"), wf).then (data) ->
            s.entries = data
            s.num_hits = data.length
            s.searching = false
            
    s.submit()


littb.controller "authorInfoCtrl", ($scope, $location, $rootScope, backend, $routeParams, $http, $document, util, $route, authors, $q, $filter) ->
    s = $scope
    _.extend s, $routeParams

    if $route.current.$$route.isSla
        s.slaMode = true
        s.author = "LagerlofS"
        
    s.showpage = null
    s.show_large = false
    s.show_more = true

    s.normalizeAuthor = $filter('normalizeAuthor')

    s.titleSort = util.titleSort

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById

        # s.authorError = (s.normalizeAuthor s.author) not of s.authorsById

    s.showLargeImage = ($event) ->
        c.log "showLargeImage", s.show_large
        if s.show_large then return 
        s.show_large = true
        $event.stopPropagation()

        $document.one "click", (event) ->
            if event.button != 0 then return
            s.$apply () ->
                s.show_large = false
        return

    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.shorttitle == attrs.title

    refreshRoute = () ->
        s.showpage = $location.path().split("/")[3]
        unless s.showpage then s.showpage = "introduktion"

    s.getUnique = (worklist) ->
        _.filter worklist, (item) ->
            "/" not in item.titlepath 
    
    s.getPageTitle = (page) ->
        {
           "titlar": "Verk i Litteraturbanken"
           "semer": "Mera om"
           "biblinfo": "Bibliografisk databas"
           "jamfor": "Textkritisk verkstad"
           "omtexterna": "Om texterna"
        }[page] or _.str.capitalize page

    s.getAllTitles = () ->
        [].concat s.groupedTitles, s.groupedWorks, s.groupedEditorWorks

    s.getUrl = (work) ->
        auth = (s.getWorkAuthor work.authors).author_id
        if work.mediatype == "epub" 
            url = "txt/epub/" + auth + "_" + work.work_title_id + ".epub"
        else if work.mediatype == "pdf"
            # url += "info"
            url = "txt/#{work.lbworkid}/#{work.lbworkid}.pdf"

        else
            url = "/forfattare/#{auth}/titlar/#{work.work_title_id}/"
            url += "sida/#{work.startpagename}/#{work.mediatype}"
        return url


    getHtml = (url) ->
        def = $q.defer()
        $http.get(url).success (xml) ->
            from = xml.indexOf "<body>"
            to = xml.indexOf "</body>"
            xml = xml[from...to + "</body>".length]
            def.resolve(_.str.trim xml)
        return def.promise


    if s.slaMode
        getHtml('/red/sla/OmSelmaLagerlofArkivet.html').then (xml) ->
            s.slaIntro = xml

    refreshExternalDoc = (page, routeParams) ->
        # sla hack
        c.log "refreshExternalDoc", page, routeParams.omtexternaDoc
        if s.slaMode
            if page == 'omtexterna' and not routeParams.omtexternaDoc
                doc = 'omtexterna.html'
            else if _.str.endsWith routeParams.omtexternaDoc, ".html"
                doc = routeParams.omtexternaDoc
            if doc
                url = '/red/sla/' + doc
            else 
                url = "/red/forfattare/#{s.author}/#{page}/index.html"
        else    
            # url = s.authorInfo[page]
            if page == "mer" then page = "semer"
            url = "/red/forfattare/#{s.author}/#{page}/index.html"
            c.log "url", url


        return unless url
        
        unless s.showpage in ["introduktion", "titlar"]
            getHtml(url).then (xml) ->
                s.externalDoc = xml
                if s.showpage == "omtexterna"
                    s.pagelinks = harvestLinks(s.externalDoc)
                else
                    s.pagelinks = null



    harvestLinks = (doc) ->
        elemsTuples = for elem in $(".footnotes .footnote[id^=ftn]", doc)
            [$(elem).attr("id"), $(elem).html()]

        s.noteMapping = _.object elemsTuples




    refreshRoute()

    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        _.extend s, current.pathParams

        refreshRoute()  
        # refreshTitle()
        refreshExternalDoc(s.showpage, current.pathParams)
        # refreshBreadcrumb()
    

    s.getDataSource = () ->
        if s.showpage == "titlar"
            s.titleStruct
        else if s.showpage == "mer"
            c.log "showpage mer"
            s.moreStruct


    s.sortOrder = (works) ->
        works[0].sortkey

    s.hasMore = () ->
        (_.flatten _.pluck s.moreStruct, "data").length

    s.titleStruct = [
            label : "Tillgängliga verk"
            data : null
            showAuthor : false
            def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "main,scholar")
        ,
            label : "Dikter, noveller, essäer, etc. som ingår i andra verk"
            data : null
            showAuthor : false
            def : backend.getPartsInOthersWorks(s.author)
        ,
            label : "Som fotograf"
            data : null
            showAuthor : (work) -> work["authors"]
            def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "photographer")
        ,
            label : "Som illustratör"
            data : null
            showAuthor : (work) -> work["authors"]
            def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "illustrator")
        ,
            label : "Som utgivare"
            data : null
            showAuthor : (work) -> work["authors"]
            def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "editor")
        ,
            label : "Som översättare"
            data : null
            showAuthor : (work) -> work["authors"]
            def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf,etext-part,faksimil-part", "translator")
        ,
            label : "Som uppläsare"
            data : null
            showAuthor : (work) -> work["authors"]
            def : backend.getAudioList({reader : s.author})
        ,
            label : "Uppläsningar"
            data : null
            showAuthor : false
            def : backend.getAudioList({author_id : s.author})
            audioExtras : true
    ]
    s.getSortOrder = (obj) ->
        if obj.showAuthor is false
            return 'sortkey'
        else
            return ['authors[0].surname', 'sortkey']

    for item in s.titleStruct
        # TODO: error handling?
        do (item) ->
            item.def.then (data) -> 
                c.log "then", data
                item.data = data


    backend.getAuthorInfo(s.author).then (data) ->
        s.authorInfo = data

        refreshExternalDoc(s.showpage, $routeParams)



        s.moreStruct = [
                label : "Verk om #{s.authorInfo.full_name}"
                data : null
                def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf", null, true)
                showAuthor : (work) -> work["authors"]
            ,
                label : "Kortare texter om #{s.authorInfo.full_name}"
                data : null
                def : backend.getPartsInOthersWorks(s.author, true)
                showAuthor : (work) -> work["authors"] or work["work_authors"]
            ,
                label : "Som utgivare"
                data : null
                def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "editor", true)
                showAuthor : (work) -> work["authors"]
            ,
                label : "Som översättare"
                data : null
                def : backend.getTextByAuthor(s.author, "etext,faksimil,pdf", "translator", true)
                showAuthor : (work) -> work["authors"]
        ]

        for item in s.moreStruct
            do (item) ->
                item.def.then (data) -> item.data = data

        if not s.authorInfo.intro
            $location.url("/forfattare/#{s.author}/titlar").replace()
    , (data) ->
        c.log("authorinfo error", arguments)
        s.authorError = true


    
littb.controller "libraryCtrl", ($scope, backend, util, $timeout, $location, authors, $rootElement, $anchorScroll, $q, $filter) ->
    s = $scope
    s.titleSearching = false
    s.authorSearching = true
    s.showPopular = true
    s.showPopularAuth = true
    s.showInitial = true
    # s.rowByLetter = {}

    s.normalizeAuthor = $filter('normalizeAuthor')

    s.getTitleTooltip = (attrs) ->
        unless attrs then return
        return attrs.title unless attrs.showtitle == attrs.title

    s.filterTitle = (row) ->    
        auths = (_.map row.authors, (auth) ->
            return auth.full_name
        ).join(" ")

        exprs = s.rowfilter.split(" ")

        return _.all exprs, (expr) ->
            new RegExp(expr, "i").test((row.itemAttrs.title + " " + row.itemAttrs.shorttitle + " " + auths + " " + row.itemAttrs.imprintyear + " "))

    isIE = detectIE()
    c.log "isIE", isIE

    if isIE and isIE < 12
        s.rowLimit = 30        

    s.filterAuthor = (author) ->
        exprs = s.rowfilter?.split(" ")

        return _.all exprs, (expr) ->
            pseudonym = (_.pluck author.pseudonym, "full_name").join(" ")
            new RegExp(expr, "i").test((author.full_name + pseudonym))

    s.resetView = () ->
        s.showInitial = true
        s.showPopularAuth = true
        s.showPopular = true
        s.showRecent = false

        s.filter = ""
        s.rowfilter = ""
        s.all_titles = null
        s.audio_list = null

    s.mediatypeObj = 
        etext : if $location.search().ej_etext then false else true
        faksimil : if $location.search().ej_faksimil then false else true
        epub : if $location.search().ej_epub then false else true
        pdf : if $location.search().ej_pdf then false else true

    s.mediatypeFilter = (row) ->
        # return true
        # c.log "row.mediatype", row.mediatype
        # s.mediatypeObj
        if row.isHeader then return true
        _.any _.map row.mediatypes, (mtObj) -> 
            s.mediatypeObj[mtObj.label]
        

    # s.titleFilter = (row) ->
    #     row.title_path.split("/").length > 1

    s.hasMediatype = (titleobj, mediatype) ->
        mediatype in (_.pluck titleobj.mediatypes, "label")

    s.pickMediatypes = (titleobj, mediatypeLabels) ->
        _.filter titleobj.mediatypes, (item) -> item.label in mediatypeLabels


    s.getTitleUrl = (titleobj) ->
        mediatype = s.sortMedia(titleObj.mediatype)[0]


    s.sortMedia = (list) ->
        order = ['etext', 'faksimil', 'epub', 'pdf']
        return _.intersection(order,list).concat(_.difference(list, order))

    s.getTitleId = (row) ->
        row.work_title_id

    s.getUniqId = (title) ->
        unless title then return
        title.lbworkid + (title.titlepath.split('/')[1] or "")
        

    s.authorRender = () ->
        c.log "authorRender"
        # s.$apply () ->
        if $location.search()['author']
            auth = s.authorsById[$location.search()['author']]
            s.authorClick(null, auth)

            s.$emit("listScroll", $location.search()['author'])


    s.titleRender = () ->
        if $location.search()['title']
            # fetchWorks().then () ->
            title = s.titleByPath?[$location.search()['title']][0]
            s.titleClick(null, title)
            id = s.getUniqId title
            s.$emit("listScroll", id)
                


    # use timeout to make sure the page shows before loading authors
    $timeout () ->
        authors.then ([authorList, authorsById]) ->
            s.authorsById = authorsById
            s.authorData = _.filter authorList, (item) ->
                item.show
            s.authorSearching = false

        backend.getPopularAuthors().then (auths) ->
            s.popularAuthors = auths
        
    , 10

    s.getAuthorData = () ->
        if s.showPopularAuth
            s.popularAuthors
        else
            s.authorData

    s.searchTitle = () ->
        c.log "searchTitle", s.filter
        s.selectedAuth = null
        s.selectedTitle = null
        s.rowfilter = s.filter
        if s.rowfilter
            s.showInitial = false
            s.showPopularAuth = false
            s.showPopular = false
            fetchTitles()
            fetchWorks()
            fetchAudio()
            if not isDev
                backend.logLibrary(s.rowfilter)
        else
            s.resetView()



    fetchTitles = () ->
        # unless s.filter then return
        backend.getParts(s.rowfilter, true).then (titleArray) ->
            s.all_titles = titleArray
    
    fetchAudio = () ->
        backend.getAudioList({string_filter : s.rowfilter, sort_field: "title.raw|asc", partial_string : true}).then (titleArray) ->
            s.audio_list = titleArray



    fetchWorks = () ->
        s.titleSearching = true
        include = "lbworkid,titlepath,title,title_id,work_title_id,shorttitle,mediatype,searchable,authors.author_id,work_authors.author_id,authors.surname,authors.authortype,startpagename,has_epub"
        # last true in args list is for partial_string match
        def = backend.getTitles(false, s.authorFilter, null, s.filter, false, false, true, include).then (titleArray) ->
            s.titleSearching = false
            s.titleArray = titleArray
            # s.titleGroups = titleGroups
            s.titleByPath = _.groupBy titleArray, (item) ->
                return item.titlepath

            return titleArray

        return def
    
    s.showAllWorks = () ->
        s.showPopular = false
        s.showRecent = false
        s.filter = ""
        s.rowfilter = ""
        s.titleArray = null
        fetchWorks()
    
    s.popClick = () ->
        s.showRecent = false
        s.showPopular = true

    s.fetchRecent = () ->
        s.showPopular = false
        s.showRecent = true
        s.filter = ""
        s.rowfilter = ""
        s.titleArray = null

        dateFmt = (datestr) ->
            months = "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december".split(",")
            [year, month, day] = datestr.split("-")
            return [Number(day), months[month - 1], year].join(" ")

        backend.getTitles(false, null, "imported|desc,sortfield|asc", null, false, true).then (titleArray) ->
            s.titleSearching = false
            # s.titleArray = titleArray

            s.titleGroups = _.groupBy titleArray, "imported"

            output = []
            for datestr, titles of s.titleGroups
                # TODO: fix locale format, 'femte maj 2017'
                # output.push {isHeader : true, label : moment(datestr, "YYYY-MM-DD").format()}
                output.push {isHeader : true, label : dateFmt(datestr)}
                output = output.concat (_.sortBy titles, ["sortfield"])

            s.titleArray = output

    s.getUrl = (row, mediatype) ->
        author_id = row.authors[0].workauthor or row.authors[0].author_id

        if mediatype == "epub" 
            url = "txt/epub/" + author_id + "_" + row.work_title_id + ".epub"
        else if mediatype == "pdf"
            url = "txt/#{row.lbworkid}/#{row.lbworkid}.pdf"
        else
            url = "/forfattare/#{author_id}/titlar/#{s.getTitleId(row)}/" +
                 "sida/#{row.startpagename}/#{mediatype}"

        return url


    s.authorClick = ($event, author) ->
        unless s.selectedAuth == author
            s.selectedAuth?._collapsed = false
        
        s.selectedAuth = author

        $location.search("author", author.author_id)
        author._infoSearching = true
        backend.getAuthorInfo(author.author_id).then (data) ->
            author._collapsed = true
            author.data = data
            author._infoSearching = false

    s.authorHeaderClick = ($event, author) ->
        if s.selectedAuth == author and author._collapsed
            author._collapsed = false
            $event?.stopPropagation()

    s.titleHeaderClick = ($event, title) ->
        if s.selectedTitle == title and title._collapsed
            title._collapsed = false
            $event?.stopPropagation()

    s.titleClick = ($event, title) ->
        unless s.selectedTitle == title
            s.selectedTitle?._collapsed = false

        s.selectedTitle = title
        s.selectedTitle._collapsed = true
        $location.search("title", title.titlepath)


    s.getPartAuthor = (part) ->
        part.authors?[0] or part.work_authors[0]


    if $location.search().nytillkommet
        s.fetchRecent()
    else
        if $location.search().filter
            s.filter = $location.search().filter
        s.searchTitle()

    util.setupHashComplex s,
        [
            key : "filter"
            # scope_name : "rowfilter"
            replace : false
        ,
            key : "ej_etext"
            expr : "!mediatypeObj.etext"
            replace : false
        ,
            key : "ej_faksimil"
            expr : "!mediatypeObj.faksimil"
            replace : false
        ,
            key : "ej_epub"
            expr : "!mediatypeObj.epub"
            replace : false
        ,
            key : "ej_pdf"
            expr : "!mediatypeObj.pdf"
            replace : false
        ,
            key : "forfattare"
            scope_name : "authorFilter"
        ,
            key : "nytillkommet"
            scope_name : "showRecent"
        ]

    onceFetchWorks = _.once () ->
        fetchWorks()

    s.listVisibleTitles = () ->
        if s.showInitial and s.showPopular
            s.popularTitles
        else
            return s.titleArray

    s.titleSearching = true

    def = backend.getTitles(false, null, "popularity|desc").then (titleArray) ->
        s.titleSearching = false
        s.popularTitles = titleArray
        s.titleByPath = _.groupBy titleArray, (item) ->
            return item.titlepath

        return titleArray


littb.controller "audioListCtrl", ($scope, backend, util, authors, $filter, $timeout, $location) ->
    s = $scope
    s.play_obj = null

    s.setPlayObj = (obj) ->
        s.play_obj = obj
        $location.search("spela", obj.file)

        $timeout( () -> 
            $("#audioplayer").get(0).play()
        )

    s.getAuthor = (author) ->
        [last, first] = author.name_for_index.split(",")

        (_.compact [last.toUpperCase(), first]).join ","

    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById


    backend.getAudioList(sort_field: "order|asc").then (audioList) ->
        c.log "audioList", audioList
        s.fileGroups = _.groupBy audioList, "section"

        if $location.search().spela
            for item in audioList
                if item.file == $location.search().spela
                    s.setPlayObj(item)
        else
            s.play_obj = audioList[0]


        $("#audioplayer").bind 'ended', () ->
            s.$apply () ->
                if audioList[s.play_obj.i + 1]
                    s.setPlayObj(audioList[s.play_obj.i + 1])

    
littb.controller "epubListCtrl", ($scope, backend, util, authors, $filter) ->
    s = $scope
    s.searching = true


    authors.then ([authorList, authorsById]) ->
        s.authorsById = authorsById

    s.authorSelectSetup = {
        formatNoMatches: "Inga resultat",
        formatResult : (data) ->
            author = s.authorsById[data.id]
            unless author then return data.text

            firstname = ""
            if author.name_for_index.split(",").length > 1
                firstname = "<span class='firstname'>, #{author.name_for_index.split(',')[1]}</span>"

            return """
            <span>
                <span class="surname sc">#{author.surname}</span>#{firstname} <span class="year">#{$filter('authorYear')(author)}</span>
            </span>
            """

        formatSelection : (item) ->
            try
                return s.authorsById[item.id].surname
            catch e
                return "Välj författare"

    }

    isIE = detectIE()
    c.log "isIE", isIE

    if isIE and isIE < 12
        s.rowLimit = 30


    # TODO: what about the workauthor issue?
    s.sorttuple = [["authors[0].name_for_index", "sortkey"], false]
    s.setSort = ([sortstr]) ->
        alternate = {
            "authors[0].name_for_index" : "sortkey"
            "sortkey" : "authors[0].name_for_index"
        }[sortstr]
        s.sorttuple[0] = [sortstr, alternate]
    s.setDir = (isAsc) ->
        s.sorttuple[1] = isAsc

    window.has = (one, two) -> one.toLowerCase().indexOf(two.toLowerCase()) != -1
    s.rowFilter = (item) ->
        author = s.authorsById?[s.authorFilter]
        if author and author.author_id != item.authors[0].author_id then return false
        if s.filterTxt
            return false if not ((has item.authors[0].full_name, s.filterTxt) or (has (item.title), s.filterTxt))
        return true

    s.getAuthor = (row) ->
        console.log("getAuthor")
        [last, first] = row.authors[0].name_for_index.split(",")
        auth = (_.compact [last.toUpperCase(), first]).join ","
        if row.authors[0].type == "editor"
            auth += " (red.)"
        return auth

    # s.log = (filename) ->
        # return true

    s.log = (row) ->
        filename = s.getFilename(row)
        if not isDev
            backend.logDownload(row.authors[0].surname, encodeURIComponent(row.shorttitle), row.lbworkid)
        # location.href = "/txt/epub/#{filename}.epub"


    s.getFilename = (row) ->
        row.authors[0].author_id + '_' + (row.work_title_id or row.title_id)


    util.setupHashComplex s,
        [
            expr : "sorttuple[0]"
            # scope_name : "sortVal"
            scope_func : "setSort"
            key : "sortering"
            default : "authors[0].name_for_index,sortkey"
            val_in : (val) ->
                val?.split(",")
            val_out : (val) ->
                val?.join(",")
            # post_change : () ->
        ,
            expr : "sorttuple[1]"
            scope_func : "setDir"
            key : "fallande"
        ,
            key : "filter"
            scope_name : "filterTxt"
        ]

    
    backend.getEpub().then (titleArray) ->
        s.searching = false
        s.rows = titleArray
        authors = _.map s.rows, (row) ->
            row.authors[0]

        s.authorData = _.unique authors, false, (item) ->
            item.author_id




littb.controller "helpCtrl", ($scope, $http, util, $location) ->
    s = $scope
    url = "/red/om/hjalp/hjalp.html"
    $http.get(url).success (data) ->
        s.htmlContent = data
        s.labelArray = for elem in $("[id]", data)
            label = _.str.humanize($(elem).attr("name").replace(/([A-Z])/g, " $1"))

            label : label
            id : $(elem).attr("id")
            
        
littb.controller "newCtrl", ($scope, $http, util, $location, backend) ->

    s = $scope

    # backend.getTitles(false, null, "imported|desc", null, false, true).then (titleArray) ->
    #     s.titleList = titleArray

    #     s.titleGroups = _.groupBy titleArray, "imported"



littb.controller "aboutCtrl", ($scope, $http, util, $location, $routeParams) ->
    s = $scope
    # s.$watch ( () -> $routeParams.page), () ->
    #     c.log "$routeParams.page", $routeParams.page
    _.extend s, $routeParams
    s.$on "$routeChangeError", (event, current, prev, rejection) ->
        c.log "route change", current.pathParams
        _.extend s, current.pathParams



    s.page = $routeParams.page
    s.getPage = (page) ->
        return {
                "ide" : '/red/om/ide/omlitteraturbanken.html'
                "hjalp" : require("../views/help.html")
                "vision" : "/red/om/visioner/visioner.html"
                "kontakt" : require('../views/contactForm.html')
                "statistik" : require('../views/stats.html')
                "rattigheter" : '/red/om/rattigheter/rattigheter.html'
                "organisation" : '/red/om/ide/organisation.html'
                # "inenglish" : "/red/om/ide/inenglish.html",
                "english.html" : "/red/om/ide/english.html",
                "deutsch.html" : "/red/om/ide/deutsch.html",
                "francais.html" : "/red/om/ide/francais.html",
            }[page]

littb.controller "presentationCtrl", ($scope, $http, $routeParams, $location, util) ->
    s = $scope
    url = '/red/presentationer/presentationerForfattare.html'
    s.isMain = true
    $http.get(url).success (data) ->
        s.doc = data
        s.currentLetters = for elem in $("[id]", data)
            $(elem).attr("id")
        util.setupHash s, {"ankare" : (val) ->
            unless val
                $(window).scrollTop(0)
                return
            $(window).scrollTop($("##{val}").offset().top)
        }

littb.controller "omtexternaCtrl", ($scope, $routeParams) ->
    docPath = '/red/sla/omtexterna/'
    $scope.doc = docPath + ($routeParams['doc'] or 'omtexterna.html')
    


littb.filter "correctLink", () ->
    (html) ->
        wrapper = $("<div>").append html
        img = $("img", wrapper)
        img.attr "src", "/red/bilder/gemensamt/" + img.attr("src")
        return wrapper.html()


littb.controller "autocompleteCtrl", ($scope, backend, $route, $location, $window, $timeout, $modal, $http) ->
    s = $scope
    modal = null
    prevFilter = null
    s.close = () ->
        s.lbworkid = null
        s.$broadcast("blur")
        # s.show_autocomplete = false
        s.completeObj = null
        c.log "close modal", s.modal, s
        s.modal?.close()
        s.modal = null


    s.onSelect = (val) ->
        c.log("scope", s)
        if not isDev
            backend.logQuicksearch(prevFilter, val.label)
        
        ret = val.action?(s)
        if ret == false then return
        # if ret.then
        #     ret.then (val) ->


        s.close()
        if val.url
            $location.url(val.url)

    

    s.autocomplete = (val) ->
        if val
            prevFilter = val
            return backend.autocomplete(val).then (data) ->
                menu = [
                        label: "Start"
                        url : "/start"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Bibliotek"
                        url : "/bibliotek"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Epub"
                        url : "/epub"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Ljudarkivet"
                        url : "/ljudarkivet"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Sök"
                        url : "/sok"
                        alt: ["Sok"]
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Presentationer"
                        url : "/presentationer"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Nytillkommet"
                        url : "/nytt"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Skolan"
                        url : "/skolan"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Skolan/lyrik"
                        url : "/skolan/lyrik"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Om"
                        url : "/om/ide"
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Hjälp"
                        url : "/om/hjalp"
                        alt : ["hjalp"]
                        typeLabel : "Gå till sidan"
                    ,
                        label: "Statistik"
                        url : "/om/statistik"
                        typeLabel : "Gå till sidan"

                ]

                if $route.current.$$route.controller == "readingCtrl"
                    menu.push 
                        label : "/id"
                        alt : ["id", "red"]
                        typeLabel: "[Red.]"
                        action : () ->
                            s.lbworkid = $(".reader_main").scope?().workinfo.lbworkid
                            return false
                    # ,
                    #     label : "/öppna"
                    #     alt : ["öppna"]
                    #     typeLabel: "[Red.]"
                    #     action : () ->
                    #         info = $(".reader_main").scope?().workinfo
                    #         win = window.open("littb-open://?lbworkid=#{info.lbworkid}&mediatype=#{info.mediatype}")
                    #         win.onload = () => win.close()
                    #         return false

                if $route.current.$$route.controller in ["readingCtrl", "authorInfoCtrl"]
                    key = {"readingCtrl" : "workinfo", "authorInfoCtrl" : "authorInfo"}[$route.current.$$route.controller]

                    menu.push
                        label : "/info"
                        alt : ["info", "db", "red"]
                        typeLabel: "[Red.]"
                        action : () ->
                            s.info = $("#mainview").scope?()[key]
                            return false
                        


                menu = _.filter menu, (item) ->
                    # if !isDev and item.typeLabel == "[Red.]" then return false
                    exp = new RegExp("^" + val, "gi")
                    # alt = new RegExp(val, "gi")
                    item.label.match(exp) or _.any item.alt?.map (item) ->
                        item.match(exp)
                return data.concat menu




    show = () ->
        # s.show_autocomplete = true

        s.modal = $modal.open
            templateUrl : "autocomplete.html"
            scope : s
            windowClass : "autocomplete"
            size : "sm"

        $timeout () ->
            s.$broadcast("focus")
        , 0
    # s.show_autocomplete = false
    s.$on "show_autocomplete", () ->
        show()
    $($window).on "keyup", (event) ->
        #tab
        if event.which == 83 and not $("input:focus,textarea:focus,select:focus").length
            s.$apply () ->
                show()



        else if event.which == 27 # escape
            s.$apply () ->
                s.close()



littb.controller "idCtrl", ($scope, backend, $routeParams, $location) ->
    s = $scope
    _.extend s, $routeParams
    s.id = s.id?.toLowerCase()
    s.titles = []
    unless _.str.startsWith s.id, "lb"
        s.titles = [s.id]
        s.id = ""

    backend.getTitles().then (titleArray) ->
        s.data = titleArray

    s.idFilter = (row) ->
        unless s.id then return true
        row.lbworkid == s.id

    s.rowFilter = (row) ->
        if not s.titles.length then return true
        return _.any _.map s.titles, (title) ->
            _.str.contains(row.titlepath.toLowerCase(), title?.toLowerCase()) or
                _.str.contains(row.title.toLowerCase(), title?.toLowerCase())


    s.textareaChange = (titles)  ->
        s.id = ''

        s.titles = _.map titles.split("\n"), (row) ->
            _.str.strip(row.split("–")[1] or row)

littb.controller "sourceInfoCtrl", ($scope, backend, $routeParams, $q, authors, $document, $location, $http) ->
    s = $scope
    {title, author} = $routeParams
    # _.extend s, $routeParams
    s.title = $routeParams.title
    s.author = $routeParams.author


    s.defaultErrataLimit = 8
    s.errataLimit = s.defaultErrataLimit
    s.isOpen = false
    s.show_large = false

    s.workinfoPromise.then () ->
        c.log "workinfo", s.workinfo
        prov = backend.getProvenance(s.workinfo)
        lic = backend.getLicense(s.workinfo)

        $q.all([prov, lic]).then ([provData, licenseData]) ->
            s.provenanceData = provData
            if provData.length
                provtmpl = "<a href='#{provData[0].link}'>#{provData[0].fullname}</a>"
            else
                provtmpl = ""
            s.licenseData = _.template(licenseData)({
                provenance: provtmpl
            })




    s.getValidAuthors = () ->
        unless s.authorById then return
        # _.filter s.workinfo?.author_idNorm, (item) ->
        #     item.id of s.authorById
        return s.workinfo?.authors

    s.toggleErrata = () ->
        s.errataLimit = if s.isOpen then 8 else 1000
        s.isOpen = !s.isOpen

    s.getUrl = (mediatype) ->
        if mediatype == "epub" 
            return s.workinfo?.epub.url
            
        else if mediatype == "pdf" 
            return s.workinfo?.pdf.url

        return "/forfattare/#{s.author}/titlar/#{s.title}/#{mediatype}"

    s.getOtherMediatypes = () ->
        (x for x in (s.workinfo?.mediatypes or []) when x != s.mediatype)

    s.getSourceImage = () ->
        if s.workinfo
            "/txt/#{s.workinfo.lbworkid}/#{s.workinfo.lbworkid}_small.jpeg"

    s.showLargeImage = ($event) ->
        if s.show_large then return 
        s.show_large = true
        $event.stopPropagation()

        $document.one "click", (event) ->
            if event.button != 0 then return
            s.$apply () ->
                s.show_large = false
        return

    
    s.getFileSize = (mediatype) ->
        # TODO: this is broken
        if not (s.workinfo and mediatype) then return
        size = s.workinfo[mediatype].file_size

        kb = size / 1024

        return (Math.round kb) + " KB"

    s.downloadFile = (url) ->
        window.location = url


    if not s.mediatype
        s.mediatype = s.workinfo.mediatypes[0]
    authors.then ([authorData, authorById]) ->
        s.authorById = authorById

littb.controller "lexiconCtrl", ($scope, backend, $location, $rootScope, $q, $timeout, $modal, util, $window) ->
    s = $scope
    s.dict_not_found = null
    s.dict_searching = false

    modal = null

    s.keydown = (event) ->
        if event.keyCode == 40 # down arrow
            # TODO: this is pretty bad but couldn't be done using the typeahead directive
            if $(".input_container .dropdown-menu").is(":hidden")
                #typeaheadTrigger directive
                s.$broadcast "open", s.lex_article

        else if event.keyCode == 27 # escape
            s.lex_article = null    


    s.showModal = () ->
        c.log "showModal", modal
        s.lexemes = s.lex_article.lexemes
        unless modal
            s.$broadcast "blur"

            modal = $modal.open
                templateUrl : "so_modal_template.html"
                scope : s

            modal.result.then () ->
                s.closeModal()
            , () ->
                s.closeModal()


    s.clickX = () ->
        modal.close()

    s.closeModal = () ->
        s.lex_article = null
        s.lexid = null
        modal = null


    reportDictError = () ->
        s.$emit "notify", "Hittade inget uppslag"
        s.dict_searching = false

    s.lexid = null


    $rootScope.$on "search_dict", (event, lemma, id, doSearchId) ->
        c.log "search_dict event", lemma, id, doSearchId
        if doSearchId then s.lexid = false

        s.dict_searching = true

        def = backend.searchLexicon(lemma, id, false, doSearchId, true)
        def.catch () ->
            c.log "searchLexicon catch"
            reportDictError()

        def.then (data) ->
            c.log "searchLexicon then", data
            s.dict_searching = false

            result = data[0]
            for obj in data
                if obj.baseform == lemma
                    result = obj
                    continue

                    
            # c.log "searchId", id
            # s.lexid = if searchId then searchId else null
            s.lex_article = result
            if id
                s.lexid = id
            s.showModal()
            

    s.getWords = (val) ->
        c.log "getWords", val
        unless val then return
        s.dict_searching = true
        def = backend.searchLexicon(val, null, true)
        timeout = $timeout(angular.noop, 800)
        def.catch () ->
            s.dict_searching = false
            reportDictError()

        $q.all([def, timeout]).then () ->
            s.dict_searching = false
            

        return def



    util.setupHashComplex s, [
        key : "so"
        expr : "lex_article.baseform"
        val_in : (val) ->
            id = $location.search().lex
            # event = if id then "search_id" else "search_dict"
            c.log "val_in", val, id
            s.$emit "search_dict", val, id, false
        replace : false            
    ,
        key : "lex"
        scope_name : "lexid"
        replace : false

    ]



