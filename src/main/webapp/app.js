Application.run(function ($rootScope) {
    "use strict";
    /* perform any action with the variables inside this block(on-page-load) */
    $rootScope.onAppVariablesReady = function () {
        /*
         * variables can be accessed through '$rootScope.Variables' property here
         * e.g. $rootScope.Variables.staticVariable1.getData()
         */
    };

    /* perform any action on session timeout here, e.g clearing some data, etc */
    $rootScope.onSessionTimeout = function () {
        /*
         * NOTE:
         * On re-login after session timeout:
         * if the same user logs in(through login dialog), app will retain its state
         * if a different user logs in, app will be reloaded and user is redirected to respective landing page configured in Security.
         */
    };

    /*
     * This application level callback function will be invoked after the invocation of PAGE level onPageReady function.
     * Use this function to write common logic across the pages in the application.
     * activePageName : name of the page
     * activePageScope: scope of the page
     * $activePageEl  : page jQuery element
     */
    $rootScope.onPageReady = function(activePageName, activePageScope, $activePageEl) {

    };
});