// -- TITLELIST -- //


package se.gu.spraakdata.littb.website.client.ui;

import java.util.ArrayList;
import java.util.HashMap;

import se.gu.spraakdata.littb.website.client.entity.AuthorListInfo;
import se.gu.spraakdata.littb.website.client.entity.LittbURL;
import se.gu.spraakdata.littb.website.client.entity.Mediatype;
import se.gu.spraakdata.littb.website.client.entity.TitleInfo;
import se.gu.spraakdata.littb.website.client.entity.TitleInfo.MediatypeInfo;
import se.gu.spraakdata.littb.website.client.entity.TitleListInfo;
import se.gu.spraakdata.littb.website.client.entity.TitleSearchData;
import se.gu.spraakdata.littb.website.client.util.Helper;
import se.gu.spraakdata.littb.website.client.util.ui.HistoryHTML;
import se.gu.spraakdata.littb.website.client.util.ui.HistoryHTMLPanel;
import se.gu.spraakdata.littb.website.client.util.ui.ToolTipHandler;

import com.google.gwt.event.dom.client.ChangeEvent;
import com.google.gwt.event.dom.client.ChangeHandler;
import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.event.dom.client.KeyCodes;
import com.google.gwt.event.dom.client.KeyDownEvent;
import com.google.gwt.event.dom.client.KeyDownHandler;
import com.google.gwt.http.client.URL;
import com.google.gwt.user.client.ui.FlexTable;
import com.google.gwt.user.client.ui.HTML;
import com.google.gwt.user.client.ui.HTMLPanel;
import com.google.gwt.user.client.ui.Image;
import com.google.gwt.user.client.ui.ListBox;
import com.google.gwt.user.client.ui.TextBox;
import com.google.gwt.user.client.ui.Widget;

public abstract class TitleList extends ListPage {
    private static final String INTRO_DIV_ID = "int-titlar9";
    private static final String FORM_DIV_ID = "int-titlar0";
    private static final String AUTHOR_SEL_DIV_ID = "int-titlar1";
    private static final String FILTER_DIV_ID = "int-titlar2";
    private static final String MEDIA_TYPE_DIV_ID = "int-titlar3";
    private static final String YEAR_SELECTION_DIV_ID = "int-titlar13";
    private static final String TEXTBOX_DIV_ID = "int-titlar4";
    private static final String HELP_TEXT_DIV_ID = "int-titlar11";
    private static final String GO_DIV_ID = "int-titlar5";
    private static final String STATUS_DIV_ID = "int-titlar6";
    private static final String TITLE_LIST_DIV_ID = "int-titlar7";
    private static final String WAIT_MESSAGE_DIV_ID = "int-titlar8";
    private static final String HEADER_DIV_ID = "int-titlar12";

    protected static final String FORM_NO_INTRO_SN = "app-titlar-formular-topp";
    protected static final String FORM_SN = "app-titlar-formular";
    protected static final String SELECTION_ROW_SN = "app-titlar-val";
    protected static final String FILTER_ROW_SN = "app-titlar-rad1";
    protected static final String PHRASE_ROW_SN = "app-titlar-rad2";
    protected final static String TEXT_BOX_SN = "app-titlar-fras";
    protected final static String STATUS_SN = "app-titlar-status";
    protected final static String RESULT_SN = "app-titlar-result";
    protected final static String WAIT_MESSAGE_SN = "app-titlar-status2";

    public static final String TITLECOLUMN_ELEMENT_SN = "app-titlar-titel";
    public static final String AUTHORCOLUMN_ELEMENT_SN = "app-titlar-forfattare";
    public static final String AUTHORCOLUMN_FIRST_ELEMENT_SN = "app-titlar-forfattare-first";
    public static final String MEDIACOLUMN_ELEMENT_SN = "app-titlar-mediatyp";

    protected static final String TITLE_COLUMN = "title-column";
    protected static final String AUTHOR_COLUMN = "author-column";
    protected static final String GENRE_COLUMN = "genre-column";
    protected static final String YEAR_COLUMN = "year-column";
    protected static final String MEDIATYPE_COLUMN = "mediatype-column";

    private static final String ALL_AUTHORS_TEXT = "Alla författare";
    private static final String ALL_WORKS_TEXT = "Samtliga verk";
    private static final String ALL_TITLES_TEXT = "Samtliga titlar";
    private static final String ALL_MEDIATYPES_TEXT = "Alla mediatyper";
    private static final String ALL_YEARS_TEXT = "Alla årtal";

    private static final String ALL_ALLOWED_HELP_TEXT = "(Lämna rutan tom för att visa alla)";
    private static final String ALL_NOT_ALLOWED_HELP_TEXT = "";

    // private static final int SPLIT_LENGTH = 500;
    // Splitta oavsett längd. Används när sökkriterierna är för få för att hämta
    // alla träffar på en gång.
    private boolean JUST_SPLIT = true;

    private HTML headerWidget;
    private HTMLPanel form;
    private ListBox authorSelection;
    private ListBox levelSelection;
    private ListBox mediatypeSelection;
    private ListBox yearSelection;
    private TextBox titlePhrase;
    private HTML searchHelpText;
    private Image go = new Image(WebPage.GO_URL);
    private FlexTable titleList;
    private HTML noHits;

    protected TableColumn[] tableColumns;
    protected HashMap<String, TableColumn> columnOnIdentifier;

    private HTML waitMessage;

    private String currentSortColumn;

    private ArrayList<String> existingLetters;
    private HashMap<String, Integer> indexOnLetter;

    private TitleSearchData filter;

    private TitleSearchData tempFilter;
    private String tempHistorytoken;

    protected String header;

    public TitleList(String name, String historyToken, String header) {
        super(name, historyToken);
        this.header = header;

        currentSortColumn = getDefaultSortColumn();

        createColumnsConfig();

        if (tableColumns != null) {
            columnOnIdentifier = new HashMap<String, TableColumn>();

            for (int i = 0; i < tableColumns.length; i++) {
                columnOnIdentifier.put(tableColumns[i].getIdentifier(),
                        tableColumns[i]);
            }
        }
    }

    protected abstract void createColumnsConfig();

    protected abstract String getDefaultSortColumn();

    void initConfig() {
        String ht = getHistoryToken();

        // TODO Vi använder hiddenHT för att hantera att resultatet kan bli att
        // vi skall visa 1 titel och då visa titelsidan.
        /*
         * Vi kan inte släppa in sökurl-en i webbläsaren förrän vi vet vilket
         * det blir, eftersom man i fallet titel då kan backa skulle kunna backa
         * tillbaka och få ett odefinierat tillstånd. Blir problem då man
         * startar Litteraturbanken med sökparametrar blir väl aldrig fallet
         * hidden? utan filtret får skapas direkt, men är det då 1 träff får vi
         * en bugg i att man kan backa tillbaka
         */
        if (LittbURL.isHiddenHT(ht)) {
            // Kan skapas som hidden om man söker från START
            tempFilter = createFilterDataFromHistoryToken(ht);
            tempHistorytoken = ht;
            filter = new TitleSearchData(true);
            filter.setMediatype(getDefaultMediatype());
            boolean fetchAll = hasEnoughSearchCriteria(filter);
            if (!fetchAll) {
                JUST_SPLIT = true;
            } else {
                JUST_SPLIT = false;
            }

            if (JUST_SPLIT)
                filter.setLetter(TitleSearchData.getDefaultStartLetter());
            historyToken = "titlar";
        } else {
            filter = createFilterDataFromHistoryToken(ht);
            boolean fetchAll = hasEnoughSearchCriteria(filter);
            if (!fetchAll) {
                JUST_SPLIT = true;
            } else {
                JUST_SPLIT = false;
            }
        }

    }

    private TitleSearchData createFilterDataFromHistoryToken(String ht) {
        TitleSearchData newFilter = null;

        String letter = LittbURL
                .getParameterValue(ht, LittbURL.INDEX_PARAMETER);
        String year = LittbURL.getParameterValue(ht, LittbURL.SEARCH_YEAR_PARAM);

        if (LittbURL.hasTitleSearchParameters(ht)) {
            newFilter = new TitleSearchData();

            String authorId = LittbURL.getParameterValue(ht,
                    LittbURL.SEARCH_AUTHOR_PARAM);
            String level = LittbURL.getParameterValue(ht,
                    LittbURL.SEARCH_LEVEL_PARAM);
            String mediatype = LittbURL.getParameterValue(ht,
                    LittbURL.SEARCH_MEDIATYPE_PARAM);
            String searchString = LittbURL.getParameterValue(ht,
                    LittbURL.SEARCH_TITLE_PARAM);


            if (authorId != null) {
                if (LittbURL.SEARCH_ALL.equals(authorId))
                    newFilter.setAuthor(null);
                else
                    newFilter.setAuthor(authorId);
            } else {
                newFilter.setAuthor(TitleSearchData.getDefaultAuthor());
            }

            if (level != null) {
                if (level.equals(LittbURL.SEARCH_LEVEL_TITLES))
                    newFilter.setLevel(TitleSearchData.ALL_TITLES);
                else
                    newFilter.setLevel(TitleSearchData.ALL_WORKS);
            } else {
                newFilter.setLevel(TitleSearchData.getDefaultLevel());
            }

            if (mediatype != null) {
                if (mediatype.equals(LittbURL.SEARCH_ALL))
                    newFilter.setMediatype(null);
                else
                    newFilter.setMediatype(Mediatype.parseString(mediatype));
            } else {
                newFilter.setMediatype(getDefaultMediatype());
            }

            if (searchString != null) {
                newFilter.setSearchString(searchString);
            } else {
                newFilter.setSearchString(TitleSearchData
                        .getDefaultSearchString());
            }

            if(year != null) {
                newFilter.setYear(year);
            }

            String sortString = LittbURL.getParameterValue(historyToken,
                    LittbURL.SORTORDER_PARAM);
            if (sortString != null) {
                newFilter.setSortColumn(getSortColumnFromParameter(sortString));
            } else {
                newFilter.setSortColumn(getDefaultSortColumn());
            }

        } else {
            // Om parametrar saknas är det desamma som sökning på default
            newFilter = new TitleSearchData(true);
            newFilter.setMediatype(getDefaultMediatype());
            if(year != null) {
                newFilter.setYear(year);
            }
        }

        if (!hasEnoughSearchCriteria(newFilter)) {
            if (letter == null)
                letter = TitleSearchData.getDefaultStartLetter();
            newFilter.setLetter(letter);
        } else {
            newFilter.setLetter(TitleSearchData.getDefaultLetter());
        }

        return newFilter;
    }

    protected abstract Mediatype getDefaultMediatype();

    @Override
    protected void initWidgets() {
        if (mainComponent == null) {
            HTMLPanel main = new HTMLPanel("<div id=\"" + WAIT_MESSAGE_DIV_ID
                    + "\"></div><div id=\"" + HEADER_DIV_ID
                    + "\"></div><div id=\"" + INTRO_DIV_ID
                    + "\"></div></div><div id=\"" + FORM_DIV_ID + "\"></div>");

            mainComponent = main;

            initDefaultWorkspace(mainComponent);

            waitMessage = new HTML("Hämtar samtliga verk" + BLINK_TEXT);
            waitMessage.setStyleName(WAIT_MESSAGE_SN);
            waitMessage.addStyleName(WebPage.RED_ITALIC_TEXT_SN);
            main.add(waitMessage, WAIT_MESSAGE_DIV_ID);

            headerWidget = new HTML();
            setHeader(header);
            main.add(headerWidget, HEADER_DIV_ID);

            toolkit = new HistoryHTMLPanel(
                    "</div><div id=\"alphabetT\"></div></div><div id=\"text\"></div>");
            // toolkit.add(getTopSubmenuLineLow(), "topBorderT");
            alphabetWidget = WebPage.createAlphabetWidget();
            toolkit.add(alphabetWidget, "alphabetT");
            // toolkit.add(getBottomSubmenuLineLow(), "bottomBorderT");
        }
    }

    private void initForm() {
        HTMLPanel main = getMainCompontent();
        main.remove(waitMessage);

        String introHtmlString = getIntroHtmlString();
        if (introHtmlString != null) {
            HistoryHTML intro = new HistoryHTML(introHtmlString);
            intro.setStyleName("app-titlar-intro");
            main.add(intro, INTRO_DIV_ID);
        }

        form = new HTMLPanel("<div class=\"" + FILTER_ROW_SN + "\"><span id=\""
                + AUTHOR_SEL_DIV_ID + "\"></span>  <span id=\"" + FILTER_DIV_ID
                + "\"></span>  <span id=\"" + MEDIA_TYPE_DIV_ID
                + "\"></span><span id=\"" + YEAR_SELECTION_DIV_ID
                + "\"></span></div><div class=\"" + PHRASE_ROW_SN
                + "\">Sök efter ord i titeln: <span id=\"" + TEXTBOX_DIV_ID
                + "\"></span><span id=\"" + GO_DIV_ID + "\">"
                + "</span>   <span id=\"" + HELP_TEXT_DIV_ID
                + "\"> </div><div id=\"" + STATUS_DIV_ID
                + "\"></div><div id=\"" + TITLE_LIST_DIV_ID
                + "\"><br /></div></div>");

        if (authorSelection != null
                && form.getWidgetIndex(authorSelection) == -1) {
            form.add(authorSelection, AUTHOR_SEL_DIV_ID);
        }

        if (hasLevelSelection()) {
            levelSelection = new ListBox();
            levelSelection.addItem(ALL_WORKS_TEXT);
            levelSelection.addItem(ALL_TITLES_TEXT);
            levelSelection.setVisibleItemCount(1);
            form.add(levelSelection, FILTER_DIV_ID);
        }

        if (hasMediatypeSelection()) {
            mediatypeSelection = new ListBox();
            mediatypeSelection.addItem(ALL_MEDIATYPES_TEXT);
            Mediatype[] types = Mediatype.getMediatypes();
            for (int i = 0; i < types.length; i++) {
                mediatypeSelection.addItem(types[i].toString());
            }
            mediatypeSelection.setVisibleItemCount(1);
            form.add(mediatypeSelection, MEDIA_TYPE_DIV_ID);
        }

        if (hasYearSelection()) {
            yearSelection = new ListBox();
            yearSelection.addItem(ALL_YEARS_TEXT);
            String[] years = getYears();
            for (int i = 0; i < years.length; i++) {
                yearSelection.addItem(years[i]);
            }
            yearSelection.setVisibleItemCount(1);
            form.add(yearSelection, YEAR_SELECTION_DIV_ID);
        }

        titlePhrase = new TextBox();
        titlePhrase.setStyleName(TEXT_BOX_SN);
        titlePhrase.addKeyDownHandler(new KeyDownHandler() {
            public void onKeyDown(KeyDownEvent event) {
                if (event.getNativeKeyCode() == KeyCodes.KEY_ENTER) {
                    testTitleSearchStateChange();
                }
            }
        });
        form.add(titlePhrase, TEXTBOX_DIV_ID);

        searchHelpText = new HTML();
        searchHelpText.addStyleName(WebPage.INLINE_SN);

        form.add(searchHelpText, HELP_TEXT_DIV_ID);

        go.setStyleName(WebPage.GO_SN);
        go.addClickHandler(new ClickHandler() {
            public void onClick(ClickEvent event) {
                testTitleSearchStateChange();
            }
        });
        form.add(go, GO_DIV_ID);

        titleList = new FlexTable();
        titleList.setStyleName(RESULT_SN);
        form.add(titleList, TITLE_LIST_DIV_ID);

        statusMessage = new HTML("");
        statusMessage.setStyleName(STATUS_SN);
        statusMessage.addStyleName(WebPage.RED_ITALIC_TEXT_SN);
        form.add(statusMessage, STATUS_DIV_ID);

        noHits = new HTML();
        noHits.setStyleName(NO_HITS_SN);

        /*titleSortControl.addStyleName(ListPage.SORTBUTTON_SN);
        titleSortControl.addClickHandler(new ClickHandler() {
            public void onClick(ClickEvent sender) {
                System.out.println("On Title click order: " +  titleSortOrderAsc);
                boolean order = titleSortOrderAsc;
                if (currentSortColumn == TitleSearchData.TITLE_SORT)
                    order = !titleSortOrderAsc;
                generateSortStateChange(TitleSearchData.TITLE_SORT, order);
            }
        });

        authorSortControl.addStyleName(ListPage.SORTBUTTON_SN);
        authorSortControl.addClickHandler(new ClickHandler() {
            public void onClick(ClickEvent sender) {
                System.out.println("On Author click order: " +  authorSortOrderAsc);
                boolean order = authorSortOrderAsc;
                if (currentSortColumn == TitleSearchData.AUTHOR_SORT)
                    order = !authorSortOrderAsc;
                generateSortStateChange(TitleSearchData.AUTHOR_SORT, order);
            }
        });*/

        setFilterWidgets();
        form.setStyleName(getFormStyleName());

        handleSearchHelpText();
        main.add(form, FORM_DIV_ID);
    }

    protected void setHeader(String newHeader) {
        headerWidget.setHTML("<h1>" + newHeader + "</h1>");
    }

    // Ändra meddelande när sökvillkoren inte är tillräckliga. Används inte i
    // nuläget då vi gick tillbaka till att tillåta att söka alla.
    private void addHelpTextChangeHandler(ListBox listBox) {
        listBox.addChangeHandler(new ChangeHandler() {

            public void onChange(ChangeEvent event) {
                handleSearchHelpText();
            }

        });
    }

    private boolean needsTitleStringCriteria() {
        String level = levelSelection.getValue(levelSelection
                .getSelectedIndex());
        if (level.equals(ALL_WORKS_TEXT))
            return false;

        String typeString = mediatypeSelection.getValue(mediatypeSelection
                .getSelectedIndex());
        Mediatype type = Mediatype.parseString(typeString);
        if (type.isExternal())
            return false;

        String authorString = authorSelection.getValue(authorSelection
                .getSelectedIndex());
        if (!authorString.equals(ALL_AUTHORS_TEXT))
            return false;

        return true;
    }

    protected abstract boolean hasMediatypeSelection();

    protected abstract boolean hasLevelSelection();

    protected abstract boolean hasYearSelection();

    protected String[] getYears() {
        return null;
    }

    protected abstract String getIntroHtmlString();

    protected abstract String getFormStyleName();

    protected abstract String getAuthorColumnStyleName();

    @Override
    void initContent() {
        if (mainContent == null) {
            ContentMediator.getAuthors(this);
            if (tempFilter == null) {
                ContentMediator.filterTitles(filter, this);
            } else {
                ContentMediator.filterTitles(tempFilter, this);
            }
        }
    }

    @Override
    void prepare(String historyToken) {
        String oldHistorytoken = getHistoryToken();
        TitleSearchData newFilter = createFilterDataFromHistoryToken(historyToken);

        String oldIndex = LittbURL.getParameterValue(getHistoryToken(),
                LittbURL.INDEX_PARAMETER);
        if (oldIndex == null)
            oldIndex = "A";
        String newIndex = LittbURL.getParameterValue(historyToken,
                LittbURL.INDEX_PARAMETER);
        if (newIndex == null)
            newIndex = "A";

        if (LittbURL.isHiddenHT(historyToken)) {
            tempFilter = createFilterDataFromHistoryToken(historyToken);
            tempHistorytoken = historyToken;
            ContentMediator.filterTitles(tempFilter, this);
        } else {
            boolean fetchAll = hasEnoughSearchCriteria(newFilter);
            if (!fetchAll) {
                JUST_SPLIT = true;
            } else {
                JUST_SPLIT = false;
            }

            String oldSort = LittbURL.getParameterValue(oldHistorytoken,
                    LittbURL.SORTORDER_PARAM);

            if (oldSort == null)
                oldSort = createDefaultSortParameterValue();


            String newSort = LittbURL.getParameterValue(historyToken,
                    LittbURL.SORTORDER_PARAM);
            if (newSort == null) {
                newSort = TitleSearchData.TITLE_SORT + "_a-o";
            }

            this.historyToken = historyToken;

            if (!historyToken.equals(oldHistorytoken)) {
                setSortValuesFromParameter(newSort);

                if (!Helper.isEqual(newSort, oldSort)) {
                    //setSortValuesFromParameter(newSort);
                    sort();
                    setUpMainContent();
                    setStatusMessage("");
                } else if (tempHistorytoken != null) {
                    tempHistorytoken = null;

                    setFilterWidgets();
                    setUpMainContent();
                } else if (!oldIndex.equals(newIndex)) {
                    if (!JUST_SPLIT)
                        setUpMainContent();
                    else {
                        titleList.setVisible(false);
                        setStatusMessage("Hämtar" + BLINK_TEXT);
                        filter.setLetter(newIndex);
                        tempHistorytoken = null;
                        ContentMediator.filterTitles(filter, this);
                    }
                } else {
                    this.filter = newFilter;
                    setFilterWidgets();
                    ContentMediator.filterTitles(filter, this);
                }

            } else {
                if (mainContent == null) {
                    setStatusMessage("Hämtar" + BLINK_TEXT);
                    ContentMediator.filterTitles(filter, this);
                } else {
                    titleList.setVisible(true);
                }
            }
        }
    }

    @Override
    void postView() {
        if (tempHistorytoken != null && tempFilter != null) {
            setStatusMessage("Söker" + BLINK_TEXT);
            ContentMediator.filterTitles(tempFilter, this);
        }
    }

    public void setContent(Object content) {
        if (form == null) {
            initForm();
        }

        if (content instanceof TitleListInfo[]) {
            TitleListInfo[] result = (TitleListInfo[]) content;

            if (tempHistorytoken != null) {
                int hits = result.length;

                // Om en träff hittas skall vi gå till TITEL
                if (hits == 1) {
                    setStatusMessage("");
                    /*
                     * Vid skapandet (new TitleList()) sätt historytoken i
                     * konstruktorn. Om det då blir en träff har vi inget valitt
                     * historytoken. Återställ till defaulturl:en.
                     */
                    if (LittbURL.isHiddenHT(getHistoryToken())) {
                        historyToken = LittbURL.TITLE_HT;
                    }
                    // Sätt tillbaka filterwidgets
                    setFilterWidgets();

                    tempFilter = null;
                    tempHistorytoken = null;

                    String titleHistoryToken;
                    TitleListInfo singleHit = result[0];
                    String authorId = singleHit.getWorkAuthorId();
                    String titleId = singleHit.getWorkTitleId();
                    MediatypeInfo mediatypeInfo = singleHit
                            .getInfoForFirstMediatype();
                    String type = null;
                    String page = null;
                    if (mediatypeInfo != null) {
                        type = mediatypeInfo.getMediatyp().toString();
                        page = mediatypeInfo.getStartpagename();
                        titleHistoryToken = LittbURL.createWorkHT(authorId,
                                titleId, page, type);
                    } else {
                        titleHistoryToken = LittbURL.createWorkHT(authorId,
                                titleId);
                    }
                    LittbURL.sendNewHistoryItem(titleHistoryToken);

                    // annars, visa lista
                } else {
                    titleList.setVisible(false);
                    setStatusMessage("Förbereder visning");
                    mainContent = result;
                    sort();
                    createExistingLetters();
                    filter = tempFilter;
                    tempFilter = null;
                    generateTitleSearchStateChange();
                }
            } else {
                mainContent = result;
                setStatusMessage("Bearbetar resultatet");
                // currentSortColumn = filter.getSortColumn();
                sort();
                createExistingLetters();
                setStatusMessage("Förbereder visning");
                setUpMainContent();
            }
        }
    }

    public void setMainContent(Object content) {
        if (content instanceof AuthorListInfo[]) {
            AuthorListInfo[] authorList = (AuthorListInfo[]) content;
            authorSelection = new ListBox();
            authorSelection.addItem(ALL_AUTHORS_TEXT);

            authorSelection.setVisibleItemCount(1);

            for (int i = 0; i < authorList.length; i++) {
                authorSelection.addItem(authorList[i].getNameForIndex());
            }

            if (form != null) {
                form.add(authorSelection, AUTHOR_SEL_DIV_ID);
                setFilterWidgets();
            }

            // addHelpTextChangeHandler(authorSelection);
        }
    }

    protected void setUpMainContent() {
        if (mainContent == null || !(mainContent instanceof TitleListInfo[]))
            return;

        // toolkit.setVisible(true);
        createTable();
        setStatusMessage("");
    }

    private void setFilterWidgets() {
        if (filter != null && authorSelection != null) {
            String authorId = filter.getAuthor();
            int index = AuthorListInfo.getIndexForAuthor(authorId);
            if (index == -1)
                index = 0;
            else
                index = index + 1;
            authorSelection.setSelectedIndex(index);

            if (hasLevelSelection()) {
                Integer levelValue = filter.getLevel();
                if (levelValue == TitleSearchData.ALL_TITLES)
                    levelSelection.setSelectedIndex(1);
                else
                    levelSelection.setSelectedIndex(0);

            }

            if (hasMediatypeSelection()) {
                Mediatype mt = filter.getMediatype();
                if (mt == null)
                    mediatypeSelection.setSelectedIndex(0);
                else {
                    int ix = getSelectionIxFromMediatype(mt);
                    mediatypeSelection.setSelectedIndex(ix);
                }
            }

            if (hasYearSelection()) {
                String year = filter.getYear();
                if (year == null)
                    yearSelection.setSelectedIndex(0);
                else {
                    int ix = getSelectionIxFromYear(year);
                    yearSelection.setSelectedIndex(ix);
                }
                System.out.println("setFilterWidgets " + year);
            }

            String searchString = filter.getSearchString();
            if (searchString == null)
                searchString = "";
            titlePhrase.setText(searchString);
        }
    }

    private int getSelectionIxFromMediatype(Mediatype mt) {
        int index = Mediatype.getIndexFor(mt);
        return index + 1;
    }

    private int getMediatypeIxForFromSelectedIx(int ix) {
        return ix - 1;
    }

    private int getSelectionIxFromYear(String year) {
        String[] years = getYears();

        if (years != null) {
            for (int i = 0; i < years.length; i++) {
                if (years[i].equals(year))
                    return i + 1;
            }
        }

        return 0;
    }

    private int getYearIxForFromSelectedIx(int ix) {
        return ix - 1;
    }

    public void createTable() {
        titleList.setVisible(false);
        titleList.clear();

        // Letters visible in the shown list (for setting alphabet
        // navigation active letters (bold))
        ArrayList<String> visibleLetters = new ArrayList<String>();

        String currentLetter = null;
        String anchorString = "";

        final TitleListInfo[] titlesList = getTitles();
        int itemCount = (titlesList == null) ? 0 : titlesList.length;

        // Split very long list, showing one letter at the time.
        boolean splitResult = false;
        int start = 0;
        int stop = itemCount;
        if (JUST_SPLIT) {
            splitResult = true;

            start = 0;
            stop = itemCount;
        }

        if (itemCount > 0) {
            titleList.getRowFormatter().addStyleName(0,
                    ListPage.TABLE_HEADER_SN);

            for (int i = 0; i < tableColumns.length; i++) {
                TableColumn currentColumn = tableColumns[i];
                int columnIx = currentColumn.getColumnIndex();
                if (currentColumn.getSortControl() != null) {
                    titleList.setWidget(0, columnIx,
                            currentColumn.getSortControl());
                } else {
                    titleList.setWidget(0, columnIx, new HTML(" "));
                }
            }


            int i = 0;
            for (int j = start; j < stop; i++, j++) {
                TitleListInfo title = titlesList[j];

                // Filtrera bort samma titel med olika författare vid
                // titelsortering utan författarval
                if (currentSortColumn == TitleSearchData.TITLE_SORT
                        && filter.getAuthor() == null && !title.isHeadAuthor())
                    continue;

                boolean isSplit = JUST_SPLIT;

                if (isSplit)
                    visibleLetters.add(filter.getLetter().toUpperCase());

                String anchorIndexstring = null;
                if (currentSortColumn.equals(TitleSearchData.TITLE_SORT))
                    anchorIndexstring = title.getTitleSortKey();
                else if (currentSortColumn.equals(TitleSearchData.AUTHOR_SORT))
                    anchorIndexstring = title.getAuthor().getNameForIndex();
                if (anchorIndexstring != null && anchorIndexstring.length() > 0) {
                    if (currentLetter == null && anchorIndexstring != null) {
                        currentLetter = anchorIndexstring.substring(0, 1);
                        anchorString = "<a id=\"" + currentLetter + "\"></a>";
                        if (!isSplit)
                            visibleLetters.add(currentLetter.toUpperCase());
                    } else if (!anchorIndexstring.startsWith(currentLetter)) {
                        currentLetter = anchorIndexstring.substring(0, 1);
                        anchorString = "<a id=\"" + currentLetter + "\"></a>";
                        if (!isSplit)
                            visibleLetters.add(currentLetter.toUpperCase());
                    } else {
                        anchorString = "";
                    }
                }

                // Create space between letters in alphabet.
                if (itemCount > ListPage.DIVIDER_COUNT
                        && !anchorString.equals("") && j != 0) {
                    for (int k = 0; k < tableColumns.length; k++) {
                        fillSpaceTableColumn(i + 1,
                                tableColumns[k].getColumnIndex(),
                                tableColumns[k].getStyleName());
                    }

                    i++;
                }

                for (int s = 0; s < tableColumns.length; s++) {
                    fillTableColumn(i + 1, tableColumns[s].getColumnIndex(),
                            tableColumns[s].getWidget(title),
                            tableColumns[s].getStyleName(), anchorString);
                }
            }

            int rows = titleList.getRowCount();
            rows--;
            i++;

            while (rows > i) {
                titleList.removeRow(rows);
                rows--;
            }

        } else {

            String noHitMessage = null;
            String levelString = "verk";
            if (filter.getLevel() == TitleSearchData.ALL_TITLES) {
                levelString = "titlar";
            }
            if (JUST_SPLIT) {
                noHitMessage = "Inga " + levelString + " på "
                        + filter.getLetter().toUpperCase() + ".";
            } else {
                noHitMessage = "Din sökning gav inga träffar.";
            }
            noHits.setHTML(noHitMessage);
            titleList.clear();
            titleList.setWidget(0, 0, noHits);
        }

        titleList.setVisible(true);

        if (splitResult && existingLetters != null) {
            WebPage.updateAlphabetWidget(alphabetWidget,
                    LittbURL.FULL_STATE_MARKER + getHistoryToken(),
                    visibleLetters, existingLetters);
        } else {
            WebPage.updateAlphabetWidget(alphabetWidget,
                    LittbURL.FULL_STATE_MARKER + getHistoryToken(),
                    visibleLetters);
        }
    }

    private void fillTableColumn(int row, int column, HTML widget,
            String styleName, String anchorString) {
        if (column == 0) {
            String points = ListPage.DOT_TEXT;
            String firstColumnHtml = widget.getHTML();
            // ! i #! escapas i widget.getHTML()
            if (firstColumnHtml != null)
                firstColumnHtml = URL.decode(firstColumnHtml);
            firstColumnHtml = "<span class=\"" + ListPage.UTFYLLT_ELEMENT_SN
                    + "\">" + anchorString + firstColumnHtml
                    + "</span><span class=\"" + ListPage.PUNKTUTFYLLNAD_SN
                    + "\">" + points + "</span>";
            widget.setHTML(firstColumnHtml);
        }

        widget.setStyleName(WebPage.TABLE_DIV_SN);
        titleList.setWidget(row, column, widget);
        titleList.getCellFormatter().addStyleName(row, column, styleName);
    }

    private void fillSpaceTableColumn(int row, int column, String styleName) {
        HTML empty = new HTML(" ");
        empty.setStyleName(ListPage.EMPTY_ELEMENT_SN);
        titleList.setWidget(row, column, empty);
        titleList.getCellFormatter().addStyleName(row, column, styleName);
    }


    // TODO Inte nöjd med upplägget här
    protected abstract boolean useAuthorNameForIndex();

    protected abstract String getWorkInfoHref(String urlAuthorId,
            String urlTitleId, TitleInfo.MediatypeInfo[] mediatypes);

    protected abstract String getMediatypeHtml(TitleListInfo title);

    private void createExistingLetters() {
        TitleListInfo[] titles = getTitles();
        String currentLetter = null;

        if (JUST_SPLIT) {
            existingLetters = new ArrayList<String>();
            indexOnLetter = null;

            existingLetters.add("A");
            existingLetters.add("B");
            existingLetters.add("C");
            existingLetters.add("D");
            existingLetters.add("E");
            existingLetters.add("F");
            existingLetters.add("G");
            existingLetters.add("H");
            existingLetters.add("I");
            existingLetters.add("J");
            existingLetters.add("K");
            existingLetters.add("L");
            existingLetters.add("M");
            existingLetters.add("N");
            existingLetters.add("O");
            existingLetters.add("P");
            existingLetters.add("Q");
            existingLetters.add("R");
            existingLetters.add("S");
            existingLetters.add("T");
            existingLetters.add("U");
            existingLetters.add("V");
            existingLetters.add("W");
            existingLetters.add("X");
            existingLetters.add("Y");
            existingLetters.add("Z");
            existingLetters.add("Å");
            existingLetters.add("Ä");
            existingLetters.add("Ö");

            indexOnLetter = null;
        } else if (titles != null && titles.length > 0) {
            existingLetters = new ArrayList<String>();
            indexOnLetter = new HashMap<String, Integer>();

            for (int i = 0; i < titles.length; i++) {
                TitleListInfo title = titles[i];

                // Filtrera bort samma titel med olika författare vid
                // titelsortering utan författarval
                if (currentSortColumn == TitleSearchData.TITLE_SORT
                        && filter.getAuthor() == null && !title.isHeadAuthor())
                    continue;

                String titlestring = title.getTitleSortKey();
                String authorstring = title.getAuthor().getNameForIndex();
                String indexstring = null;

                if (currentSortColumn == TitleSearchData.TITLE_SORT)
                    indexstring = titlestring;
                else if (currentSortColumn == TitleSearchData.AUTHOR_SORT)
                    indexstring = authorstring;
                if (indexstring != null && indexstring.length() > 0) {
                    String indexLetter = indexstring.substring(0, 1)
                            .toUpperCase();

                    if (currentLetter == null
                            || !currentLetter.equals(indexLetter)) {
                        currentLetter = indexLetter;
                        existingLetters.add(currentLetter);
                        indexOnLetter.put(currentLetter, i);
                    }
                }
            }
        } else {
            existingLetters = null;
            indexOnLetter = null;
        }
    }

    private void sort() {
        TitleListInfo[] list = getTitles();
        tableColumns[getTableColumIxForId(currentSortColumn)].sort(list);
    }

    private void generateSortStateChange(String sortColumn, boolean asc) {
        System.out.println("generateSortStateChange " + sortColumn);
        String order = null;
        if (asc)
            order = ListPage.SORT_ORDER_ASC;
        else
            order = ListPage.SORT_ORDER_DEC;

        titleList.setVisible(false);
        setStatusMessage("Sorterar " + BLINK_TEXT);
        String sortOrder = createSortParameterValue(sortColumn, order);

        LittbURL.sendNewHistoryItem(createTitleListHT(filter.getAuthor(),
                filter.getLevel(), filter.getMediatype(),
                filter.getSearchString(), sortOrder, filter.getLetter()));
    }

    private void generateTitleSearchStateChange() {
        String sort = currentSortColumn;
        String order = getCurrentSortOrder();
        // Sätt sortering till titel, asc om författare är vald
        String author = filter.getAuthor();
        if (author != null) {
            sort = TitleSearchData.TITLE_SORT;
            order = ListPage.SORT_ORDER_ASC;
        }

        String sortOrder = createSortParameterValue(sort, order);
        LittbURL.sendNewHistoryItem(createTitleListHT(filter.getAuthor(),
                filter.getLevel(), filter.getMediatype(),
                filter.getSearchString(), sortOrder, filter.getLetter()));
    }

    private void testTitleSearchStateChange() {
        TitleSearchData testFilter = createFilterFromWidgetValues();

        boolean currentSplit = JUST_SPLIT;

        if (!hasEnoughSearchCriteria(testFilter)) {
            testFilter.setLetter(TitleSearchData.getDefaultStartLetter());
            JUST_SPLIT = true;
        } else {
            JUST_SPLIT = false;
            testFilter.setLetter(TitleSearchData.getDefaultLetter());
        }

        titleList.setVisible(false);
        setStatusMessage("Söker" + BLINK_TEXT);
        tempFilter = testFilter;
        WebPageHandler.newItemBypassingHistory(createTitleListHT(
                tempFilter.getAuthor(), tempFilter.getLevel(),
                tempFilter.getMediatype(), tempFilter.getSearchString(), null,
                tempFilter.getLetter()));
    }

    private void handleSearchHelpText() {
        // Vi tillåter alltid alla för tillfället.
        // TitleSearchData filter = createFilterFromWidgetValues();
        // boolean enoughCriteria = hasEnoughSearchCriteria(filter);
        setSearchHelpText(true);
    }

    private boolean hasEnoughSearchCriteria(TitleSearchData filter) {
        if (LittbURL.isSpfSite())
            return true;
        if (filter.getSearchString().trim().length() > 0)
            return true;
        if (!(filter.getAuthor() == null))
            return true;

        Mediatype type = filter.getMediatype();
        if (type != null && type.isExternal())
            return true;

        return false;
    }

    private void setSearchHelpText(boolean allAllowed) {
        if (allAllowed) {
            searchHelpText.setHTML(ALL_ALLOWED_HELP_TEXT);
        } else {
            searchHelpText.setHTML(ALL_NOT_ALLOWED_HELP_TEXT);
        }
    }

    protected abstract String createTitleListHT(String author, Integer level,
            Mediatype mediatype, String searchString, String sortOrder,
            String index);

    private static String createSortParameterValue(String column, String order) {
        return column + "_" + order;
    }

    private String createDefaultSortParameterValue() {
        return createSortParameterValue(getDefaultSortColumn(),
                ListPage.SORT_ORDER_ASC);
    }

    private String createSortParameterValue() {
        String order = getCurrentSortOrder();

        return createSortParameterValue(currentSortColumn, order);
    }

    public void setSortValuesFromParameter(String param) {
        String[] sortValue = param.split("_");

        boolean asc = true;

        if (sortValue.length == 2) {
            currentSortColumn = sortValue[0];

            if (sortValue[1].equals(ListPage.SORT_ORDER_DEC))
                asc = false;



            /*if (sortValue[0].equals(TitleSearchData.AUTHOR_SORT)) {
                currentSortColumn = TitleSearchData.AUTHOR_SORT;
                authorSortOrderAsc = asc;
            } else {
                currentSortColumn = TitleSearchData.TITLE_SORT;
                titleSortOrderAsc = asc;
            }*/
        } else {
            currentSortColumn = TitleSearchData.TITLE_SORT;
            //titleSortOrderAsc = true;
        }

        Integer ix = getTableColumIxForId(currentSortColumn);

        if (ix == null) ix = 0;

        tableColumns[ix].setSortOrder(asc);
    }

    public String getSortColumnFromParameter(String param) {
        String[] sortValue = param.split("_");

        if (sortValue.length == 2) {
            if (sortValue[0].equals(TitleSearchData.AUTHOR_SORT)) {
                return TitleSearchData.AUTHOR_SORT;

            } else {
                return TitleSearchData.TITLE_SORT;
            }
        } else {
            return TitleSearchData.TITLE_SORT;
        }
    }

    public boolean getSortOrderFromParameter(String param) {
        String[] sortValue = param.split("_");

        if (sortValue.length == 2) {
            if (sortValue[1].equals(ListPage.SORT_ORDER_DEC))
                return false;
            else
                return true;
        } else {
            return true;
        }
    }

    private String getCurrentSortOrder() {
        return getStringValueForSortOrder(getCurrentSortColumn().getSortOrder());
    }

    private String getStringValueForSortOrder(boolean asc){
        if (asc) return ListPage.SORT_ORDER_ASC;
        else return ListPage.SORT_ORDER_DEC;
    }

    private TableColumn getCurrentSortColumn(){
        return tableColumns[getTableColumIxForId(currentSortColumn)];
    }

    private TitleSearchData createFilterFromWidgetValues() {
        // Utgå från defaultvärden och sätt värden om de hittas
        TitleSearchData newFilter = new TitleSearchData(true);

        if (authorSelection != null) {
            int authorIx = authorSelection.getSelectedIndex();
            if (authorIx > 0) {
                AuthorListInfo author = AuthorListInfo
                        .getAuthorForIndex(authorIx - 1);
                if (author != null)
                    newFilter.setAuthor(author.getAuthorId());
            }
        } else {
            newFilter.setAuthor(null);
        }

        if (hasLevelSelection()) {
            int levelIx = levelSelection.getSelectedIndex();
            if (levelIx == 0) {
                newFilter.setLevel(TitleSearchData.ALL_WORKS);
            } else {
                newFilter.setLevel(TitleSearchData.ALL_TITLES);
            }
        } else {
            newFilter.setLevel(TitleSearchData.ALL_WORKS);
        }

        if (hasMediatypeSelection()) {
            int selectedIx = mediatypeSelection.getSelectedIndex();
            if (selectedIx > 0) {
                int ix = getMediatypeIxForFromSelectedIx(selectedIx);
                newFilter.setMediatype(Mediatype.getMediatypes()[ix]);
            }
        } else {
            newFilter.setMediatype(getDefaultMediatype());
        }

        System.out.println("createFilterFromWidgetValues hasYearSelection() " + hasYearSelection());
        if (hasYearSelection()) {
            int selectedIx = yearSelection.getSelectedIndex();
            if (selectedIx > 0) {
                int ix = getYearIxForFromSelectedIx(selectedIx);
                newFilter.setYear(getYears()[ix]);
            }
            System.out.println("createFilterFromWidgetValues " + selectedIx + " " + getYearIxForFromSelectedIx(selectedIx));
        } else {
            newFilter.setYear(TitleSearchData.getDefaultYear());
        }

        newFilter.setSearchString(titlePhrase.getText().trim());

        return newFilter;
    }

    private void setStatusMessage(String message) {
        if (statusMessage != null)
            statusMessage.setHTML(message);
    }

    public HTMLPanel getMainCompontent() {
        return (HTMLPanel) mainComponent;
    }

    private TitleListInfo[] getTitles() {
        return (TitleListInfo[]) mainContent;
    }

    protected String getWorkpaceFontStyleName() {
        return WebPage.BODY_SN;
    }

    protected String getWorkspaceLinkTypeStyleName() {
        return WebPage.LIST_LINK_SN;
    }

    protected void initMetaTags() {
        metaTags = new MetaTag[] { new MetaTag(DESCRIPTION_META_TAG_NAME,
                "Sök verk eller titel i Litteraturbanken.") };
    }

    private static HashMap<String, Integer> ixOnId = new HashMap<String, Integer>();

    public static int getTableColumIxForId(String id){
        return ixOnId.get(id);
    }

    protected class TableColumn {
        // Identifier is one of TitleList constants named *_COLUMN
        String identifier;
        int columnIndex;
        Image sortControl;
        Boolean sortOrder;
        String sortName;
        AbstractRowValue widgetFactory;
        String styleName;

        public TableColumn(String identifier, int columnIndex,
                Boolean sortOrder, String sortName,
                AbstractRowValue widgetFactory, String styleName) {
            this.identifier = identifier;
            this.columnIndex = columnIndex;
            this.sortOrder = sortOrder;
            this.sortName = sortName;

            ixOnId.put(sortName, columnIndex);

            if (sortName != null) {
                createSortControl();
            }

            this.widgetFactory = widgetFactory;
            this.styleName = styleName;
        }

        public void setSortOrder(boolean newOrder){
            this.sortOrder = newOrder;
        }

        public boolean getSortOrder(){
            return sortOrder;
        }

        public String getIdentifier() {
            return identifier;
        }

        public int getColumnIndex() {
            return columnIndex;
        }

        public Widget getSortControl() {
            return sortControl;
        }

        public void sort(TitleListInfo[ ] list){
            if (sortName.equals(TitleSearchData.TITLE_SORT)) {
                TitleListInfo.sortOnTitle(list, sortOrder);
            } else if (sortName.equals(TitleSearchData.AUTHOR_SORT)) {
                TitleListInfo.sortOnAuthor(list, sortOrder);
            } else if (sortName.equals(TitleSearchData.GENRE_SORT)) {
                TitleListInfo.sortOnGenre(list, sortOrder);
            } else if (sortName.equals(TitleSearchData.YEAR_SORT)) {
                TitleListInfo.sortOnYear(list, sortOrder);
            }
        }

        public HTML getWidget(TitleListInfo title) {
            return widgetFactory.getWidget(title);
        }

        public String getStyleName() {
            return styleName;
        }

        private void createSortControl() {
            sortControl = new Image(ListPage.SORTBUTTON_IMAGE_URL);
            sortControl.addStyleName(ListPage.SORTBUTTON_SN);

            sortControl.addClickHandler(new ClickHandler() {
                public void onClick(ClickEvent sender) {
                    boolean order = sortOrder;
                    if (currentSortColumn.equals(sortName))
                        order = !sortOrder;
                    generateSortStateChange(sortName, order);
                }
            });
        }
    }

    protected abstract class AbstractRowValue {
        public abstract HTML getWidget(TitleListInfo title);
    }

    protected class TitleRowValue extends AbstractRowValue {
        public HTML getWidget(TitleListInfo title) {
            TitleInfo.MediatypeInfo[] availableMediatypes = title
                    .getMediatypes();
            String urlAuthorId = title.getAuthorId();
            String urlTitleId = title.getWorkTitleId();
            String titleHref = getWorkInfoHref(urlAuthorId, urlTitleId,
                    availableMediatypes);
            String titlestring = title.getShortTitle();
            String titleHtml = Helper.createHtmlLinkString(titleHref,
                    titlestring);

            HistoryHTML widget = new HistoryHTML(titleHtml);
            if (title.getTitle().length() > titlestring.length()) {
                ToolTipHandler titleTooltip = new ToolTipHandler(
                        title.getTitle(), 5000, WebPage.TOOLTIP_SN, false);
                widget.addMouseOverHandler(titleTooltip);
                widget.addMouseOutHandler(titleTooltip);
            }
            return widget;
        }
    }

    protected class AuthorRowValue extends AbstractRowValue {
        public HTML getWidget(TitleListInfo title) {
            String urlAuthorId = title.getAuthorId();

            String authorstring = "";
            String infoString = "";
            if (useAuthorNameForIndex()) {
                authorstring = title.getAuthorNameForIndexString();
                infoString = title.getAuthorNameForIndexInfoString();
            } else {
                authorstring = title.getAuthorString();
                infoString = title.getAuthorInfoString();
            }

            String authorHref = LittbURL.createAuthorHT(urlAuthorId);
            String authorHtml = Helper.createHtmlLinkString(authorHref,
                    authorstring);

            HistoryHTML widget = new HistoryHTML(authorHtml);
            if (infoString != null) {
                ToolTipHandler authorToolTip = new ToolTipHandler(infoString,
                        5000, WebPage.TOOLTIP_SN);
                widget.addMouseOverHandler(authorToolTip);
                widget.addMouseOutHandler(authorToolTip);
            }
            return widget;
        }
    }

    protected class MediatypeRowValue extends AbstractRowValue {
        public HTML getWidget(TitleListInfo title) {
            String mediatypeHtml = getMediatypeHtml(title);

            return new HistoryHTML(mediatypeHtml.toString());
        }
    }

    protected class YearRowValue extends AbstractRowValue {
        public HTML getWidget(TitleListInfo title) {
            return new HTML(title.getYear());
        }
    }

    protected class GenreRowValue extends AbstractRowValue {
        public HTML getWidget(TitleListInfo title) {
            return new HTML(title.getGenre());
        }
    }

}


// -- ContentMediator -- //

public static void filterTitles(TitleSearchData filter, final WebPage page) {
        final String authorId = filter.getAuthor();
        Integer level = filter.getLevel();
        final Mediatype mediatype = filter.getMediatype();
        final String phrase = filter.getSearchString();
        final String letter = filter.getLetter();
        final String year = filter.getYear();

        if (level.equals(TitleSearchData.ALL_WORKS)) {
            if (TitleInfo.hasList()) {
                handleTitleSearchAllWorks(authorId, mediatype, phrase, letter, year, page);
            } else {
                ContentHandler.getTitlesXML(new RequestCallback() {
                    public void onError(Request r, Throwable e) {
                        page.setErrorMessage(e.getMessage());
                        e.printStackTrace();
                    }

                    public void onResponseReceived(Request request,
                            Response response) {
                        ResponseDataHolder responseHolder = new ResponseDataHolder(
                                response);

                        if (!responseHolder.hasError()) {
                            ArrayList<TitleListInfo> temp = ContentProcesser
                                    .processTitlesXML(responseHolder
                                            .getDocument());
                            TitleInfo.setList(temp);
                            handleTitleSearchAllWorks(authorId, mediatype,
                                    phrase, letter, year, page);
                        } else {
                            page.setErrorMessage(responseHolder
                                    .getErrorMessage());
                        }

                        handleVarningMessage(responseHolder, page);
                    }
                });
            }
        } else if (level.equals(TitleSearchData.ALL_TITLES)) {
            if (authorId != null) {
                if (TitleInfo.hasTitlesForAuthor(authorId)) {
                    handleTitleSearchAllTitlesForAuthor(authorId, mediatype,
                            phrase, letter, year, page);
                } else {
                    // Hämta fram alla författarens titlar
                    ContentHandler.getWorksInLBWithParts(authorId,
                            new RequestCallback() {
                                public void onError(Request r, Throwable e) {
                                    page.setErrorMessage(e.getMessage());
                                    e.printStackTrace();
                                }

                                public void onResponseReceived(Request request,
                                        Response response) {
                                    ResponseDataHolder responseHolder = new ResponseDataHolder(
                                            response);

                                    if (!responseHolder.hasError()) {
                                        ArrayList<TitleListInfo> temp = ContentProcesser
                                                .processTitlesXML(responseHolder
                                                        .getDocument());
                                        TitleListInfo[] list = new TitleListInfo[temp
                                                .size()];
                                        temp.toArray(list);
                                        TitleInfo.setTitlesForAuthor(authorId,
                                                list);
                                        handleTitleSearchAllTitlesForAuthor(
                                                authorId, mediatype, phrase,
                                                letter, year, page);
                                    } else {
                                        page.setErrorMessage(responseHolder
                                                .getErrorMessage());
                                    }

                                    handleVarningMessage(responseHolder, page);
                                }
                            });
                }
            } else {
                if ((mediatype != null && mediatype.isExternal()) || (phrase != null && phrase.trim().length() > 0)) {
                    ContentHandler.getAllTitlesByTitelAndMediatype(phrase,
                            mediatype, new RequestCallback() {
                                public void onError(Request r, Throwable e) {
                                    page.setErrorMessage(e.getMessage());
                                    e.printStackTrace();
                                }

                                public void onResponseReceived(Request request,
                                        Response response) {
                                    ResponseDataHolder responseHolder = new ResponseDataHolder(
                                            response);

                                    if (!responseHolder.hasError()) {
                                        ArrayList<TitleListInfo> temp = ContentProcesser
                                                .processTitlesXML(responseHolder
                                                        .getDocument());
                                        TitleListInfo[] hits = new TitleListInfo[temp
                                                .size()];
                                        temp.toArray(hits);
                                        page.setContent(hits);
                                    } else {
                                        page.setErrorMessage(responseHolder
                                                .getErrorMessage());
                                    }

                                    handleVarningMessage(responseHolder, page);
                                }
                            });
                } else {
                    if (letter == null) return;
                    ContentHandler.getTitleByLetterXML(letter, new RequestCallback() {
                                public void onError(Request r, Throwable e) {
                                    page.setErrorMessage(e.getMessage());
                                    e.printStackTrace();
                                }

                                public void onResponseReceived(Request request,
                                        Response response) {
                                    ResponseDataHolder responseHolder = new ResponseDataHolder(
                                            response);

                                    if (!responseHolder.hasError()) {
                                        ArrayList<TitleListInfo> temp = ContentProcesser
                                                .processTitlesXML(responseHolder
                                                        .getDocument());
                                        TitleListInfo[] hits = new TitleListInfo[temp
                                                .size()];
                                        temp.toArray(hits);
                                        page.setContent(hits);
                                    } else {
                                        page.setErrorMessage(responseHolder
                                                .getErrorMessage());
                                    }

                                    handleVarningMessage(responseHolder, page);
                                }
                            });
                }
            }
        }
    }



    // -- ContentProcessor -- //

    public static ArrayList<TitleListInfo> processTitlesXML(NodeList titles,
                boolean hasAuthor) {
            ArrayList<TitleListInfo> titleList = null;

            if (titles != null) {
                HashMap<String, TitleInfo> hashMap = new HashMap<String, TitleInfo>();
                titleList = new ArrayList<TitleListInfo>();

                for (int i = 0; i < titles.getLength(); i++) {
                    Node node = titles.item(i);
                    if (!node.getNodeName().equals(LIST_ITEM_XMLNAME))
                        continue;

                    NamedNodeMap a = node.getAttributes();
                    String lbId = getAttributeValue(a, TitleInfo.LBWORK_ID_XMLNAME);
                    // TODO Ta raden nedan bort när api är fixat
                    if (lbId == null)
                        lbId = getAttributeValue(a, "bookid");
                    String titlePath = getAttributeValue(a,
                            TitleInfo.TITLE_PATH_XMLNAME);
                    String id = createTempTitleInfoId(lbId, titlePath);

                    TitleInfo titleInfo = hashMap.get(id);
                    if (titleInfo == null) {
                        String title = getAttributeValue(a, TitleInfo.TITLE_XMLNAME);
                        String shortTitle = getAttributeValue(a,
                                TitleInfo.SHORT_TITLE_XMLNAME);
                        String showTitle = getAttributeValue(a,
                                TitleInfo.SHOW_TITLE_XMLNAME);
                        String titleSortKey = getAttributeValue(a,
                                TitleInfo.TITLE_SORT_KEY_XMLNAME);
                        Boolean proofRead = getBooleanAttributeValue(a,
                                TitleInfo.PROOF_READ_XMLNAME);
                        String imprintyear = getAttributeValue(a,
                                TitleInfo.IMPRINT_YEAR_XMLNAME);
                        String genre = getAttributeValue(a, TitleInfo.GENRE_XMLNAME);

                        titleInfo = new TitleInfo(lbId, titlePath, title,
                                shortTitle, showTitle, titleSortKey, proofRead,
                                imprintyear, genre);
                        hashMap.put(id, titleInfo);

                        /* TODO Här (if/else) hanteras verk-i-lb kontra TITLAR_A-Ö. */
                        if (hasAuthor) {
                            String authorId = getAttributeValue(a,
                                    TitleInfo.AUTHOR_ID_XMLNAME);
                            String nameForIndex = getAttributeValue(a,
                                    TitleInfo.NAME_FOR_INDEX_XMLNAME);
                            String fullname = getAttributeValue(a,
                                    TitleInfo.FULLNAME_XMLNAME);
                            String surname = getAttributeValue(a,
                                    TitleInfo.SURNAME_XMLNAME);
                            String authorType = getAttributeValue(a,
                                    TitleInfo.AUTHOR_TYPE_XMLNAME);
                            String isPartAuthorString = getAttributeValue(a,
                                    TitleInfo.IS_PART_AUTHOR_XMLNAME);
                            boolean isPartAuthor = false;
                            if (isPartAuthorString != null
                                    && isPartAuthorString.length() > 0)
                                isPartAuthor = Boolean
                                        .parseBoolean(isPartAuthorString);
                            String workAuthorId = getAttributeValue(a,
                                    TitleInfo.WORK_AUTHOR_ID_XMLNAME);
                            TitleInfo.TitleAuthor newAuthor = null;
                            if (isPartAuthor && workAuthorId != null) {
                                newAuthor = titleInfo.new TitleAuthor(workAuthorId,
                                        null, null, null, null);
                            } else {
                                newAuthor = titleInfo.new TitleAuthor(authorId,
                                        fullname, nameForIndex, surname, authorType);
                            }

                            titleInfo.addTitleAuthor(newAuthor);

                            titleList.add(new TitleListInfo(titleInfo, newAuthor));
                        } else {
                            NodeList itemChildren = node.getChildNodes();
                            for (int k = 0; k < itemChildren.getLength(); k++) {
                                Node itemCd = itemChildren.item(k);
                                if (itemCd.getNodeName().equals(
                                        TitleInfo.AUTHORS_XMLNAME)) {
                                    NodeList authors = itemCd.getChildNodes();
                                    for (int n = 0; n < authors.getLength(); n++) {
                                        Node author = authors.item(n);
                                        if (!author.getNodeName().equals(
                                                TitleInfo.AUTHOR_XMLNAME))
                                            continue;

                                        NamedNodeMap authorAttributes = author
                                                .getAttributes();
                                        String authorId = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.AUTHOR_ID_XMLNAME);
                                        String nameForIndex = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.NAME_FOR_INDEX_XMLNAME);
                                        String fullname = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.FULLNAME_XMLNAME);
                                        String surname = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.SURNAME_XMLNAME);
                                        String authorType = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.AUTHOR_TYPE_XMLNAME);

                                        String workAuthorId = getAttributeValue(
                                                authorAttributes,
                                                TitleInfo.WORK_AUTHOR_ID_XMLNAME);
                                        String workShortTitle = getAttributeValue(
                                                a,
                                                TitleInfo.WORK_SHORT_TITLE_XMLNAME);
                                        boolean isPartAuthor = (workAuthorId != null && workAuthorId
                                                .trim().length() > 0);

                                        // Denna rad är fix för att
                                        // getTitlesByString inte anger isPartAuthor
                                        // (se över om samor de olika anropen)
                                        if (workAuthorId == null)
                                            titleInfo.setWorkAuthorIdAndShortTitle(
                                                    authorId, workShortTitle);

                                        TitleInfo.TitleAuthor newAuthor = null;
                                        if (isPartAuthor) {
                                            titleInfo.setWorkAuthorIdAndShortTitle(
                                                    workAuthorId, workShortTitle);
                                        }

                                        newAuthor = titleInfo.new TitleAuthor(
                                                authorId, fullname, nameForIndex,
                                                surname, authorType);
                                        titleInfo.addTitleAuthor(newAuthor);

                                        titleList.add(new TitleListInfo(titleInfo,
                                                newAuthor));
                                    }

                                }
                            }
                        }
                    }

                    String mediatypeName = getAttributeValue(a,
                            TitleInfo.MEDIATYP_XMLNAME);

                    Mediatype mediatype = Mediatype.parseString(mediatypeName);
                    if (!titleInfo.isMediatypeAdded(mediatype)) {
                        String startpagename = getAttributeValue(a,
                                TitleInfo.STARTPAGENAME_XMLNAME);
                        String startpageIndex = getAttributeValue(a,
                                TitleInfo.STARTPAGEINDEX_XMLNAME);
                        TitleInfo.MediatypeInfo newMediaType = titleInfo.new MediatypeInfo(
                                mediatype, startpagename, startpageIndex);
                        titleInfo.addMediatype(newMediaType);
                    }
                }
            }

            return titleList;
        }
