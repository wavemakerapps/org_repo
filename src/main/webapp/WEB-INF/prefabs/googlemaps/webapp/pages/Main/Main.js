var $q = App.getDependency("$q");
var $compile = App.getDependency("$compile");
var wmToaster = App.getDependency("ToasterService");
var $http = App.getDependency("HttpService");
var NgMap = App.getDependency("NgMap");
var $el = $;
var Utils = App.getDependency("Utils");
/*global WM,_,google,Application*/

'use strict';
var prefabScope, _locations = [],
    _icon = '',
    _lat = '',
    _lng = '',
    latSum = 0,
    lngSum = 0,
    latNaNCount = 0,
    lngNaNCount = 0,
    infoWindow, customMarker, customMarkers = [],
    defaultCenter = 'current-position',
    _oldBoundLocations = -1,
    _buildMap, _updateDirections, _refreshMap, _deregisterFns = {
        'directions': _.noop
    },
    addressFetchPromises = [],
    heatmap, heatmapHidden = false,
    _checkMapStatus;
Prefab.isMapLoading = true;
Prefab.heatmapData = [];
Prefab.maps = [];
Prefab.markersData = [];
Prefab.directionsData = [];
Prefab.onMapLoad = _refreshMap; //needed whenever the performance is too low on browser.
//sets the heat map layer properties
function assignHeatMapLayers() {
    heatmap = _.get(Prefab, 'maps[0].heatmapLayers.heatmapLayer');
}
//returns the LatLng Object required for mapping the markers
function constructLatLngObject(lat, lng) {
    if (google) {
        return new google.maps.LatLng(lat, lng);
    }
}

function markLatLng(lat, lng, markerId) {
    //points the marker based on lat & lng
    if (!Prefab.maps[0] && (!_lat || !_lng)) {
        return;
    }
    if (isNaN(lat) || isNaN(lng)) {
        return;
    }
    clearNoIdMarker();
    var latlngObj = constructLatLngObject(lat, lng);
    customMarker = new google.maps.Marker({
        'position': latlngObj,
        'map': Prefab.maps[0],
        'draggable': true,
        'animation': google.maps.Animation.DROP
    });

    Prefab.maps[0].panTo(latlngObj);
    if (markerId) {
        customMarker.$$id = markerId.toString();
    }
    customMarkers.push(customMarker);
}

function markAddress(address, markerId) {
    //points the marker based on address , can also be used when lat&lng is in the same string
    var baseUrl, results, geometryLocations;
    if (!address) {
        return;
    }
    baseUrl = 'https://maps.googleapis.com/maps/api/geocode/json?address=';
    $http.get(baseUrl + address).then(function (response) {
        results = response.data.results[0];
        if (!results) {
            return;
        }
        geometryLocations = results.geometry.location;
        markLatLng(geometryLocations.lat, geometryLocations.lng, markerId);
    });

}

function _removeMarkers(markerArray) {
    //removes all the markers if the markerArray is not passed
    if (!markerArray) {
        _.forEach(customMarkers, function (marker) {
            marker.setMap(null);
            marker = null;
        });

        customMarkers = [];
    } else {
        _.forEach(customMarkers, function (marker, index) {
            if (marker) {
                if (_.includes(markerArray, marker.$$id.toString())) {
                    marker.setMap(null);
                    marker = null;
                    customMarkers.splice(index, 1);
                }
            }
        });

    }
}

function clearNoIdMarker() {
    _.forEach(customMarkers, function (marker, index) {
        if (marker) {
            if (!marker.$$id) {
                marker.setMap(null);
                marker = null;
                customMarkers.splice(index, 1);
            }
        }
    });

}
Prefab.clearMarkers = _removeMarkers;

function removeMarker(markerIds) {
    //removes the marker placed based on marker Id
    var markerArray = [];
    if (!markerIds) {
        return;
    }
    if (_.isObject(markerIds) || _.isArray(markerIds)) {
        markerArray = markerIds;
        _removeMarkers(markerArray);
    } else {
        markerArray.push(markerIds);
        _removeMarkers(markerArray);
    }
}

function prepareLatLngData(lat, lng) {
    var latlng;
    if (lat && lng) {
        latlng = '[' + lat + ', ' + lng + ']';
    }
    if (isNaN(lat) || lat === null || lat === '') {
        latNaNCount++;
    } else {
        latSum += Number(lat);
    }
    if (isNaN(lng) || lng === null || lng === '') {
        lngNaNCount++;
    } else {
        lngSum += Number(lng);
    }
    return latlng;
}

function setCenter() {
    //based on the locations binded, sets the center of the map
    var len = Prefab.maptype === 'Markers' ? Prefab.markersData.length : Prefab.heatmapData.length,
        lat = latSum / (len - latNaNCount),
        lng = lngSum / (len - lngNaNCount);
    if (!len) {
        return;
    }
    Prefab.center = (len === latNaNCount || len === lngNaNCount) ? '[0,0]' : '[' + lat + ', ' + lng + ']';
    Prefab.centerData = {
        'lat': lat,
        'lng': lng
    };

    _refreshMap();
}

function alterMarkersObject(markerIndex, responseLatLng) {
    //alter the already prepared marker object's latlng property
    if (Prefab.markersData[markerIndex]) {
        Prefab.markersData[markerIndex].latlng = responseLatLng;
    }
}
// removes the improper markers from the model
function sanitizeMarkers() {
    _.remove(Prefab.markersData, function (marker) {
        return !marker.latlng;
    });

    setCenter();
}

function getLatLng(markerIndex, address) {
    //this function fetches the lat and lng and constructs the marker Object
    var lat, lng, addrPromise;
    if (!address) {
        return;
    }
    addrPromise = $q.defer();
    $http.get('https://maps.googleapis.com/maps/api/geocode/json?address=' + address).then(function (response) {
        addrPromise.resolve(response);
        var resultdataSet = response.data.results[0],
            geometryLocations, latlng;
        if (resultdataSet) {
            geometryLocations = resultdataSet.geometry.location;
            lat = geometryLocations.lat;
            lng = geometryLocations.lng;
            latlng = prepareLatLngData(lat, lng);
            alterMarkersObject(markerIndex, latlng);
        }
    });

    addressFetchPromises.push(addrPromise.promise);
}
//selects the activeMarker based on markerindex
function assignActiveMarker(p) {
    _.forEach(_locations, function (marker) {
        if (marker.markerIndex === p.markerIndex) {
            prefabScope.activeMarker = marker;
            return false;
        }
    });

}
Prefab.onMarkerHover = function (event, p) {
    assignActiveMarker(p);
    Utils.triggerFn(Prefab.onMarkerhover, {
        widget: Prefab
    });

};

Prefab.onMarkerClick = function (event, p) {
    Utils.triggerFn(Prefab.onMarkerclick, {
        widget: Prefab
    });

    Prefab.showInfoWindow(event, p);
};

Prefab.showInfoWindow = function (event, p) {
    //opens the info-window specific to the marker , fixes the bug 'info-window' directive fails to load the info
    if (!(Prefab.info || Prefab.setInfoWindow) || !google || !p.latlng) {
        return;
    }
    var content = '',
        latlngData = p.latlng.replace(/\[|\]/g, '').split(','),
        center = constructLatLngObject(latlngData[0], latlngData[1]);
    if (infoWindow) {
        //close other info windows if they're open
        infoWindow.close();
    }
    if (Prefab.setInfoWindow) {
        content = $compile('<div>' + Utils.triggerFn(Prefab.setInfoWindow) + '</div>')(Prefab.$new())[0].outerHTML;
    } else {
        content = '<div><p>' + p.information + '</p></div>';
    }
    infoWindow = new google.maps.InfoWindow({
        'content': content,
        'pixelOffset': new google.maps.Size(0, -30)
    });

    infoWindow.setPosition(center);
    infoWindow.open(Prefab.maps[0]);
};

//resets the map and when the binded dataset is empty, sets the defaultCenter
function resetMap(dataset) {
    latSum = lngSum = latNaNCount = lngNaNCount = 0;
    Prefab.heatmapData.length = 0;
    Prefab.markersData.length = 0;
    assignHeatMapLayers();
    if (heatmap) {
        heatmap.setMap(heatmap.getMap() ? null : Prefab.maps[0]);
        heatmapHidden = true;
    }
    if (!dataset) {
        Prefab.center = '[0,0]';
        Prefab.centerData = {
            lat: 0,
            lng: 0
        };

        _refreshMap();
        return false;
    }
    return true;
}
// adds marker to the markersData model
function addMarkerToModel(markerObj) {
    Prefab.markersData.push(markerObj);
}
//constructs the marker object
function constructMarkersModel() {
    var markerIndex = 0;
    if (!resetMap(_locations)) {
        return;
    }
    _.forEach(_locations, function (marker, index) {
        var lat, lng, address = '',
            markerObj;
        if (marker === null || !marker) {
            return;
        }
        marker.markerIndex = markerIndex;
        markerObj = {
            'iconData': _icon ? Utils.findValueOf(marker, _icon) : '',
            'information': Prefab.info ? Utils.findValueOf(marker, Prefab.info) : '',
            'id': Prefab.$id + '_' + index,
            'color': Prefab.shade ? Utils.findValueOf(marker, Prefab.shade) : '',
            'radius': Prefab.radius ? Utils.findValueOf(marker, Prefab.radius) : '',
            'markerIndex': markerIndex
        };

        if (Prefab.markertype === 'Address') {
            if (!Prefab.address) {
                return;
            }
            addMarkerToModel(markerObj);
            Prefab.addressData = Prefab.address.split(' ');
            _.forEach(Prefab.addressData, function (addrValue, index) {
                addrValue = Utils.findValueOf(marker, Prefab.addressData[index]) + ' ';
                address += addrValue || '';
            });

            getLatLng(markerIndex, address);
        } else {
            lat = Utils.findValueOf(marker, _lat);
            lng = Utils.findValueOf(marker, _lng);
            if (!lat || !lng) {
                return;
            }
            markerObj.latlng = prepareLatLngData(lat, lng);
            addMarkerToModel(markerObj);
        }
        markerIndex++;
    });

    $q.all(addressFetchPromises).then(sanitizeMarkers);
}

function buildMap() {
    if (Prefab.maptype !== 'Markers') {
        return;
    }
    var paramsExists;
    if (_locations) {
        paramsExists = Prefab.address ? true : (!(!_lat || !_lng));
        if (!paramsExists) {
            return;
        }
        if (!Prefab.address) {
            constructMarkersModel();
            setCenter();
        } else {
            constructMarkersModel();
        }
    } else {
        Prefab.center = defaultCenter;
    }
}
_buildMap = _.debounce(buildMap, 50);

function onMarkerTypeChange(newVal) {
    var wp = Prefab.widgetProps;
    if (newVal === 'Address') {
        wp.address.show = true;
        wp.lat.show = wp.lng.show = false;
        App.notify('set-markup-attr', Prefab.widgetid, {
            'lat': '',
            'lng': ''
        });

    } else if (newVal === 'LatLng') {
        wp.address.show = false;
        wp.lat.show = wp.lng.show = true;
        App.notify('set-markup-attr', Prefab.widgetid, {
            'address': ''
        });

    }
}

function assignLocations(dataset, columns, wp) {
    var TypeUtils, options;
    dataset = _.cloneDeep(dataset);
    _locations = [];
    if (_.isArray(dataset)) {
        _locations = dataset;
    } else {
        if (_.isObject(dataset) && _.isArray(dataset.data) && !_.isEmpty(dataset.data)) {
            _locations = dataset.data;
        } else {
            _locations = dataset ? [dataset] : [];
        }
    }
    if (Prefab.widgetid) {
        TypeUtils = Utils.getService('TypeUtils');
        columns = TypeUtils.getFieldsForExpr(Prefab.bindlocations);
        options = [''];
        wp.lat.options = options;
        wp.lng.options = options;
        wp.icon.options = options;
        wp.info.options = options;
        wp.shade.options = options;
        wp.radius.options = options;
        wp.address.options = options;
        if (columns.length > 0) {
            _.forEach(columns, function (key) {
                options.push(key);
            });

        } else if (_locations.length > 0) {
            _.forEach(_locations[0], function (val, key) {
                options.push(key);
            });

        }
    }
}

function onLocationsChange(newVal) {
    var wp = Prefab.widgetProps,
        columns = [];
    //assign the locations and options
    assignLocations(newVal, columns, wp);
    if (Prefab.widgetid) {
        if ((_oldBoundLocations !== -1) && (_oldBoundLocations !== Prefab.bindlocations)) {
            /*Remove the attributes from the markup*/

            App.notify('set-markup-attr', Prefab.widgetid, {
                'lat': '',
                'lng': '',
                'icon': '',
                'info': '',
                'shade': '',
                'radius': '',
                'address': ''
            });

            Prefab.lat = '';
            Prefab.lng = '';
            Prefab.icon = '';
            Prefab.info = '';
            Prefab.shade = '';
            Prefab.radius = '';
            Prefab.address = '';
            _oldBoundLocations = Prefab.bindlocations;
        }
        if (_oldBoundLocations === -1) {
            _oldBoundLocations = Prefab.bindlocations;
        }
    }
    _buildMap();
}

function updateDirections() {
    if (Prefab.origin && Prefab.destination) {
        Utils.triggerFn(_deregisterFns.directions);
        //watch for the directions
        _deregisterFns.directions = angular.$watch(':: maps[0].directionsRenderers', function (nv) {
            //if there are no directions return back. nv is undefined between page navigation in studio mode
            if (!nv) {
                return;
            }
            var directionsObj = nv,
                distance = 0,
                duration = 0;
            //iterate throughout the object as there might be multiple waypoints and directions on the map.
            _.forEach(directionsObj, function (direction) {
                var routes = _.get(direction, 'directions.routes');
                _.forEach(routes, function (route) {
                    var legs = route.legs;
                    _.forEach(legs, function (leg) {
                        distance += _.get(leg, 'distance.value') || 0;
                        duration += _.get(leg, 'duration.value') || 0;
                    });

                });

            });

            distance = distance ? _.round(distance / 1000, 2) : '';
            duration = duration ? _.round(duration / 3600, 2) : '';
            Prefab.distance = distance;
            Prefab.duration = duration;
        });

    }
}
_updateDirections = _.debounce(updateDirections, 50);

function prepareWayPoints(wayPointsObj) {
    if (Prefab.waypoints) {
        var newWayPoints = [],
            showStopOver;
        if (_.isArray(Prefab.waypoints)) {
            Prefab.directionsData.wayPoints = [];
            showStopOver = true;
            if (wayPointsObj) {
                _.forEach(wayPointsObj, function (wayPoint) {
                    wayPoint.stopover = Prefab.stopover;
                    newWayPoints.push(wayPoint);
                });

                Prefab.directionsData.wayPoints = newWayPoints;
            }
        } else if (_.isString(Prefab.waypoints) && CONSTANTS.isStudioMode) {
            showStopOver = false;
            wmToaster.warn('Waypoints bound cannot be of string type, Please refer documentation for more details');
        }
        Prefab.widgetProps.stopover.show = showStopOver;
    }
}
//prepare the params necessary for the heat map
function prepareHeatMapData(newVal) {
    var wp = Prefab.widgetProps,
        columns = [];
    if (!resetMap(newVal)) {
        //if newVal is empty then reset the map and return
        return;
    }
    assignLocations(newVal, columns, wp);
    //if lat lng properties are not assigned do not construct the heatmap model
    if (!_lat || !_lng) {
        return;
    }
    _.forEach(_locations, function (location) {
        if (location === null || !location) {
            return;
        }
        var loc = {};

        loc.latitude = Utils.findValueOf(location, _lat);
        loc.longitude = Utils.findValueOf(location, _lng);
        if (!loc.latitude || !loc.longitude) {
            return;
        }
        prepareLatLngData(loc.latitude, loc.longitude);
        Prefab.heatmapData.push(constructLatLngObject(loc.latitude, loc.longitude));
    });

    Prefab.isHeatMapDataReady = true;
    setCenter();
    assignHeatMapLayers();
    if (heatmapHidden && heatmap) {
        heatmap.setMap(Prefab.maps[0]);
        heatmapHidden = false;
    }
}

function changeMapType(type) {
    if (type === 'Markers') {
        onLocationsChange(Prefab.locations);
    } else if (type === 'Heatmap') {
        prepareHeatMapData(Prefab.locations);
    }
}
//depending on map type set the paramters and other properties
function mapTypeOperations(newVal) {
    if (Prefab.widgetid) {
        var wp = Prefab.widgetProps,
            markerProps = ['onMarkerclick', 'onMarkerhover', 'onClick', 'radius', 'shade', 'info', 'icon', 'markertype', 'locations', 'lat', 'lng', 'viewtype'],
            heatmapProps = ['locations', 'lat', 'lng', 'gradient', 'pixeldensity', 'opacity', 'viewtype'],
            routeProps = ['origin', 'destination', 'trafficlayer', 'transitlayer', 'travelmode', 'waypoints', 'stopover', 'viewtype'],
            commonProps = ['name', 'tabindex', 'maptype', 'zoom', 'height', 'width', 'show', 'animation', 'onLoad', 'onDestroy', 'accessroles', 'class', 'margin', 'active', 'debugurl', 'showindevice'],
            maptypeProps;
        wp.zoom.options = ['Auto', 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
        if (newVal === 'Markers') {
            wp.lat.displayName = 'Marker Latitude';
            wp.lng.displayName = 'Marker Longitude';
            maptypeProps = markerProps;
        } else if (newVal === 'Heatmap') {
            wp.lat.displayName = 'Latitude';
            wp.lng.displayName = 'Longitude';
            maptypeProps = heatmapProps;
        } else {
            maptypeProps = routeProps;
        }
        _.forEach(wp, function (property, key) {
            if (_.includes(maptypeProps, key)) {
                property.show = true;
            } else if (!_.includes(commonProps, key)) {
                property.show = false;
            }
        });

        //set the Address , LatLng properties based on maptype and location type
        if (newVal === 'Markers') {
            if (Prefab.markertype === 'Address') {
                wp.lat.show = wp.lng.show = false;
                wp.address.show = true;
            } else {
                wp.address.show = false;
                wp.lat.show = wp.lng.show = true;
            }
        }
        if (newVal !== 'Route') {
            resetMap();
            Prefab.directionsData.length = 0;
        } else {
            Prefab.markersData.length = 0;
            Prefab.heatmapData.length = 0;
        }
    }
    changeMapType(newVal);
}
//handles the property value changes made to gradient,opacity, pixel density
function handleHeatMapPropChanges(key, value) {
    assignHeatMapLayers();
    if (!key && heatmap) {
        heatmap.set('gradient', heatmap.get('gradient') ? null : Prefab.gradient);
        heatmap.set('opacity', heatmap.get('opacity') ? null : Prefab.opacity);
        heatmap.set('radius', heatmap.get('radius') ? null : Prefab.pixeldensity);
        return;
    }
    if (!heatmap || !value) {
        return;
    }
    if (key === 'pixeldensity') {
        key = 'radius';
    }
    heatmap.set(key, heatmap.get(key) ? null : value);
}
//on Location change prepare data based on map type
function triggerLocationFn(dataset) {
    if (Prefab.maptype === 'Markers') {
        onLocationsChange(dataset);
    } else if (Prefab.maptype === 'Heatmap') {
        prepareHeatMapData(dataset);
    }
}

function triggerLatLngChanges() {
    if (Prefab.maptype === 'Markers') {
        _buildMap();
    } else if (Prefab.maptype === 'Heatmap') {
        prepareHeatMapData(Prefab.locations);
    }
}
/* Define the property change handler. This function will be triggered when there is a change in the prefab property */

function propertyChangeHandler(key, newVal) {
    switch (key) {
    case 'maptype':
        mapTypeOperations(newVal);
        break;
    case 'locations':
        triggerLocationFn(newVal);
        break;
    case 'gradient':
    case 'opacity':
    case 'pixeldensity':
        handleHeatMapPropChanges(key, newVal);
        break;
    case 'markertype':
        onMarkerTypeChange(newVal);
        break;
    case 'address':
        _buildMap();
        break;
    case 'lat':
        _lat = newVal;
        triggerLatLngChanges();
        break;
    case 'lng':
        _lng = newVal;
        triggerLatLngChanges();
        break;
    case 'icon':
        _icon = newVal;
        _buildMap();
        break;
    case 'shade':
    case 'radius':
        if (Prefab.widgetid) {
            _buildMap();
        }
        break;
    case 'zoom':
        if (!isNaN(newVal)) {
            Prefab.zoomLevel = newVal >= 2 ? newVal : 2;
        }
        break;
    case 'origin':
        if (Prefab.maptype === 'Route') {
            Prefab.directionsData.origin = newVal;
            _updateDirections();
        }
        break;
    case 'destination':
        if (Prefab.maptype === 'Route') {
            Prefab.directionsData.destination = newVal;
            _updateDirections();
        }
        break;
    case 'waypoints':
        prepareWayPoints(newVal);
        Prefab.widgetProps.stopover.show = newVal ? true : false;
        break;
    case 'travelmode':
        Prefab.travelMode = newVal.toUpperCase();
        break;
    case 'trafficlayer':
        Prefab.trafficLayer = newVal;
        break;
    case 'transitlayer':
        Prefab.transitLayer = newVal;
        break;
    case 'show':
        if (newVal) {
            $el.find('ng-map').css('height', Prefab.height);
            _refreshMap();
        }
        break;
    }
}

function refresh() {
    //check if the maps object is formed and then refresh
    if (!Prefab.maps[0]) {
        return;
    }
    var mapData = Prefab.maps[0];
    //re-size the map whenever the map is loaded in any container like dialog, tabs or any hidden elements
    setTimeout(function () {
        google.maps.event.trigger(mapData, 'resize');
        //check for the lat, lng values if they're NaN and they exist
        if (Prefab.centerData && (!(isNaN(Prefab.centerData.lat) || isNaN(Prefab.centerData.lng)))) {
            mapData.panTo(constructLatLngObject(Prefab.centerData.lat, Prefab.centerData.lng));
        }
    }, 100);
}
/* register the property change handler */

Prefab.onPropertyChange = propertyChangeHandler;
_refreshMap = _.debounce(refresh, 80);
//toggle the loader visibility based on the requirement
function toggleLoader(visibility) {
    setTimeout(function () {
        Prefab.isMapLoading = visibility;
    });

}
//checks if the map is back to the idle state by comparing the bounds i.e checking if the map tiles are loaded
function checkMapStatus() {
    if (Prefab.maps[0].lastBounds == Prefab.maps[0].getBounds()) {
        toggleLoader(false);
    } else {
        Prefab.maps[0].lastBounds = Prefab.maps[0].getBounds();
        _checkMapStatus();
    }
}
_checkMapStatus = _.debounce(checkMapStatus, 500);
App.subscribe('mapInitialized', function (event, evtMap) {
    Prefab.maps.push(evtMap);
    $el.find('div[name=googlemapview]').css('z-index', '15'); //over-rides the prefab default z-index //needed when the search widget is on top of the map, results are overlapped by map
    handleHeatMapPropChanges();
    _refreshMap(); //now call the refresh method to resize map, needed when the map is inside the dialogs or any other hidden element
    //add event listener to enable the spinner when an operation is performed on maps
    google.maps.event.addListener(evtMap, 'bounds_changed', function () {
        toggleLoader(true);
        _checkMapStatus();
    });

    //hide the spinner when the map comes back to the idle state.
    google.maps.event.addListener(evtMap, 'idle', function () {
        evtMap.lastBounds = evtMap.getBounds();
        toggleLoader(false);
    });

    //this function places the marker based on the click event lat/lng values
    function placeMarker(location) {
        var marker = new google.maps.Marker({
            position: location,
            map: evtMap
        });

        evtMap.panTo(location);
        google.maps.event.addListener(marker, 'click', function (event) {
            prefabScope.activeMarker = {
                'event': event,
                'marker': marker
            };

            Utils.triggerFn(Prefab.onMarkerClick.bind(event, event.latLng));
        });

    }
    //if the onClick event is specified then add a active click listener on the map
    if (Prefab.onClick) {
        Utils.triggerFn(function () {
            google.maps.event.addListener(evtMap, 'click', function (event) {
                prefabScope.activeClick = {
                    'event': event,
                    'latLng': event.latLng
                };

                if (Prefab.addMarkerOnClick) {
                    placeMarker(event.latLng);
                }
                Utils.triggerFn(Prefab.onClick);
            });

        });

    }
    if (Prefab.maptype === 'Heatmap') {
        evtMap.setZoom(evtMap.zoom - 1);
    }
    _checkMapStatus();
});

App.subscribe('$destroy', function () {
    assignHeatMapLayers();
    if (heatmap) {
        heatmap.setMap(null);
    }
    $el.remove(); //clears the element and the references created by google to draw the map (as a fix for IE)
    //clear all the created event listeners / heatmap instance if any existed
    if (!Prefab.map) {
        return;
    }
    Prefab.map.heatmapLayer = undefined;
});

Prefab.refresh = _refreshMap;
prefabScope = $el.closest('.app-prefab').isolateScope();
prefabScope.redraw = _refreshMap;
prefabScope.markLatLng = markLatLng;
prefabScope.markAddress = markAddress;
prefabScope.removeMarker = removeMarker;
prefabScope.clearAllMarkers = _removeMarkers;
prefabScope.showInfoWindow = Prefab.showInfoWindow;
