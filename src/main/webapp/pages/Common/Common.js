var DialogService = App.getDependency("DialogService");
/* perform any action on widgets/variables within this block */

Partial.onReady = function () {
    /*
     * variables can be accessed through 'Partial.Variables' property here
     * e.g. to get dataSet in a staticVariable named 'loggedInUser' use following script
     * Partial.Variables.loggedInUser.getData()
     * 
     * widgets can be accessed through 'Partial.Widgets' property here
     * e.g. to get value of text widget named 'username' use following script
     * 'Partial.Widgets.username.datavalue'
     */

};

Partial.CommonLoginDialog_CommonLoginDialogError = function ($event, widget) {
    /*
     * Error message can be accessed from the property widget.loginMessage.caption
     */

};

Partial.CommonLoginDialog_CommonLoginDialogSuccess = function ($event, widget) {
    /*
     * This success handler provides a redirectUrl which is the role based url set while configuring Security service for the project.
     * The redirectUrl can be accessed as widget.redirectUrl
     * To navigate to the url use 'window' service as:
     * window.location = widget.redirectUrl
     */

    DialogService.hideDialog("CommonLoginDialog");
};

