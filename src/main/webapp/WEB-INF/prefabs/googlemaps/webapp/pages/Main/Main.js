// Google Map Service Objects
var trafficLayer,
    transitLayer,
    directionsService,
    directionsDisplay,
    heatMap;

// Map options
var defaultCenter = {
        lat: 0,
        lng: 0
    },
    latSum = 0,
    lngSum = 0,
    invalidLatLngCount = 0,
    mapBounds = false,
    _refreshMap,
    _updateDirectionsMap,
    _buildMarkersMap,
    _buildHeatMap,
    _checkMapStatus,
    customMarkers = [],
    infoWindow;

Prefab.isMapLoading = false;
Prefab.maps = [];
Prefab.heatMapData = [];
Prefab.directionsData = [];
Prefab.markersData = [];

/*
 * This function will be invoked when any of this prefab's property is changed
 * @key: property name
 * @newVal: new value of the property
 * @oldVal: old value of the property
 */
Prefab.onPropertyChange = function (key, newVal, oldVal) {
    handlePropertyChangeInStudioMode(key, newVal, oldVal);
    if (typeof google === 'undefined') {
        return;
    }
    switch (key) {
    case 'maptype':
        onLocationsChange(newVal, Prefab.locations);
        break;
    case 'locations':
        onLocationsChange(Prefab.maptype, newVal);
        break;
    case 'lat':
    case 'lng':
        onLocationsChange(Prefab.maptype, Prefab.locations);
        break;
    case 'markertype':
    case 'address':
    case 'icon':
    case 'shade':
    case 'radius':
        _buildMarkersMap(Prefab.locations);
        break;
    case 'gradient':
    case 'opacity':
    case 'pixeldensity':
        handleHeatMapPropChanges(key, newVal);
        break;
    case 'origin':
    case 'destination':
    case 'waypoints':
    case 'travelmode':
        if (Prefab.maptype === 'Route') {
            _updateDirectionsMap();
        }
        break;
    case 'trafficlayer':
        if (Prefab.maps.length) {
            addOrRemoveTrafficLayer(Prefab.maps[0], newVal);
        }
        break;
    case 'transitlayer':
        if (Prefab.maps.length) {
            addOrRemoveTransitLayer(Prefab.maps[0], newVal);
        }
        break;
    case 'zoom':
        if (Prefab.maps.length) {
            Prefab.maps[0].setZoom(newVal);
        }
        break;
    case 'viewtype':
        if (Prefab.maps.length) {
            Prefab.maps[0].setMapTypeId(newVal.toUpperCase());
        }
        break;
    }
};


function handlePropertyChangeInStudioMode(key, newVal, oldVal) {
    if (!Prefab.isStudioMode || !Prefab.widgetProps) {
        return;
    }
    switch (key) {
    case 'maptype':
        var commonProps = ['name', 'tabindex', 'apikey', 'maptype', 'zoom', 'height', 'width', 'show', 'animation', 'onLoad', 'onDestroy', 'accessroles', 'class', 'margin', 'active', 'debugurl', 'showindevice'];

        if (newVal === 'Markers') {
            var mapTypeProps = ['onMarkerclick', 'onMarkerhover', 'onClick', 'radius', 'shade', 'info', 'icon', 'markertype', 'locations', 'lat', 'lng', 'viewtype'];
        } else if (newVal === 'Heatmap') {
            var mapTypeProps = ['locations', 'lat', 'lng', 'gradient', 'pixeldensity', 'opacity', 'viewtype'];
        } else if (newVal === 'Route') {
            var mapTypeProps = ['origin', 'destination', 'trafficlayer', 'transitlayer', 'travelmode', 'waypoints', 'stopover', 'viewtype'];
        } else {
            var mapTypeProps = [];
        }

        _.forEach(Prefab.widgetProps, function (property, key) {
            if (_.includes(mapTypeProps, key)) {
                Prefab.widgetProps[key].show = true;
            } else if (!_.includes(commonProps, key)) {
                Prefab.widgetProps[key].show = false;
            }
        });


        if (newVal === 'Markers') {
            Prefab.widgetProps.lat.displayName = 'Marker Latitude';
            Prefab.widgetProps.lng.displayName = 'Marker Longitude';
            onMarkerTypeChangeInStudioMode(Prefab.markertype);
        } else if (newVal === 'Heatmap') {
            Prefab.widgetProps.lat.displayName = 'Latitude';
            Prefab.widgetProps.lng.displayName = 'Longitude';
        }
        break;
    case 'locations':
        var options = [''];
        var _locations = normalizeLocations(newVal);
        var typeUtilsObj = Utils.getService('TypeUtils');
        var columns = typeUtilsObj.getFieldsForExpr(Prefab.bindlocations);

        function getKeyString(object, prefix) {
            _.forEach(object, function (val, key) {
                var option = prefix ? prefix + '.' + key : key;
                options.push(option);
                if (_.isObject(val)) {
                    getKeyString(val, option);
                }
            })
        }
        if (columns.length > 0) {
            _.forEach(columns, function (key) {
                options.push(key);
            });

        } else if (_locations.length > 0) {
            getKeyString(_locations[0], '');
        }
        _.forEach(['lat', 'lng', 'icon', 'info', 'shade', 'radius', 'address'], function (prop) {
            Prefab.widgetProps[prop].options = options;
        });

        break;
    case 'markertype':
        onMarkerTypeChangeInStudioMode(newVal);
        break;
    }
}

function onMarkerTypeChangeInStudioMode(markerType) {
    if (markerType === 'Address') {
        Prefab.widgetProps.address.show = true;
        Prefab.widgetProps.lat.show = Prefab.widgetProps.lng.show = false;
    } else if (markerType === 'LatLng') {
        Prefab.widgetProps.address.show = false;
        Prefab.widgetProps.lat.show = Prefab.widgetProps.lng.show = true;
    }
}

function onLocationsChange(mapType, locations) {
    if (mapType === 'Markers') {
        _buildMarkersMap(locations);
    } else if (mapType === 'Heatmap') {
        _buildHeatMap(locations);
    } else if (mapType === 'Route') {
        _updateDirectionsMap();
    }
}

/*
 * This function will be triggered post initialization of the prefab.
 */
Prefab.onReady = function () {
    var mapApiUrl = 'https://maps.googleapis.com/maps/api/js?v=3&libraries=places,visualization,drawing,geometry';

    if (!_.isEmpty(Prefab.apikey)) {
        mapApiUrl += '&key=' + Prefab.apikey;
    }

    if (!(typeof google !== "undefined" && google !== null ? google.maps : void 0)) {
        jQuery.cachedScript(mapApiUrl).then(initMap);
    } else if (!Prefab.maps.length) {
        Prefab.initMap();
    }
};


function initMap(data, textStatus, jqxhr) {
    var mapEle = Prefab.Widgets.mapContainer.$element.get(0);
    mapEle.style.height = Prefab.height;
    var map = new google.maps.Map(mapEle, {
        center: Prefab.center ? Prefab.center : defaultCenter,
        zoom: (isNaN(Prefab.zoom) || Prefab.zoom < 2) ? 2 : Prefab.zoom,
        MapTypeId: Prefab.viewtype ? Prefab.viewtype.toUpperCase() : 'ROADMAP'
    });


    Prefab.maps.push(map);

    onLocationsChange(Prefab.maptype, Prefab.locations);

    //add event listener to enable the spinner when an operation is performed on maps
    google.maps.event.addListener(map, 'bounds_changed', function () {
        // toggleLoader(true);
        _checkMapStatus();
    });


    //hide the spinner when the map comes back to the idle state.
    google.maps.event.addListener(map, 'idle', function () {
        map.lastBounds = map.getBounds();
        // toggleLoader(false);
    });


    // if the onClick event is specified then add a active click listener on the map
    if (Prefab.onClick) {
        google.maps.event.addListener(map, 'click', function (event) {
            Prefab.activeClick = {
                'event': event,
                'latLng': event.latLng
            };


            if (Prefab.addMarkerOnClick) {
                var marker = new google.maps.Marker({
                    position: event.latLng,
                    map: map
                });


                map.panTo(event.latLng);

                addMarkerEvents(marker, marker);
            }
            Prefab.onClick(Prefab);
        });

    }

    _checkMapStatus();
    // toggleLoader(false);
}

//toggle the loader visibility based on the requirement
function toggleLoader(visibility) {
    setTimeout(function () {
        Prefab.isMapLoading = visibility;
    });

}

//checks if the map is back to the idle state by comparing the bounds i.e checking if the map tiles are loaded
function checkMapStatus() {
    if (Prefab.maps[0].lastBounds == Prefab.maps[0].getBounds()) {
        // toggleLoader(false);
    } else {
        Prefab.maps[0].lastBounds = Prefab.maps[0].getBounds();
        _checkMapStatus();
    }
}
_checkMapStatus = _.debounce(checkMapStatus, 500);

function getValueFromObj(obj, keyStr) {
    if (!obj || !keyStr) {
        return;
    }

    var keyParts = keyStr.trim().split('.');

    _.forEach(keyParts, function (key) {
        if (_.isObject(obj) && !obj.hasOwnProperty(key)) {
            return undefined;
        }
        var tempObj = obj[key];
        obj = tempObj;
    });

    return obj;
}

function resetMap(dataset) {
    removeRouteMap()
    removeHeatMap();
    if (Prefab.markersData.length) {
        _.forEach(Prefab.markersData, function (markerObj) {
            if (markerObj.marker) {
                markerObj.marker.setMap(null);
            }
            if (markerObj.circleOverlay) {
                markerObj.circleOverlay.setMap(null);
            }
        });

    }
    latSum = 0;
    lngSum = 0;
    invalidLatLngCount = 0;
    mapBounds = false;
    Prefab.heatMapData = [];
    Prefab.markersData = [];
    Prefab.directionsData = [];
    Prefab.center = defaultCenter;
    if (!dataset) {
        _refreshMap();
        return false;
    }
    return true;
}

function refresh() {
    if (!Prefab.maps[0]) {
        return;
    }
    var map = Prefab.maps[0];
    //re-size the map whenever the map is loaded in any container like dialog, tabs or any hidden elements
    setTimeout(function () {
        google.maps.event.trigger(map, 'resize');
        //check for the lat, lng values if they're NaN and they exist
        if (Prefab.center && (!(isNaN(Prefab.center.lat) || isNaN(Prefab.center.lng)))) {
            map.panTo(createLatLngObject(Prefab.center.lat, Prefab.center.lng));
        }
    }, 100);
}
_refreshMap = _.debounce(refresh, 80);

//based on the locations binded, sets the center of the map
function setCenter() {
    var len = Prefab.maptype === 'Markers' ? Prefab.markersData.length : Prefab.heatMapData.length,
        lat = latSum / len,
        lng = lngSum / len,
        center = {
            'lat': lat,
            'lng': lng
        };


    if (!len) {
        return;
    }
    Prefab.center = len ? center : defaultCenter;
    _refreshMap();
}

function prepareLatLngData(lat, lng) {
    var latLng;
    if (validateLatLng(lat, lng)) {
        latSum += Number(lat);
        lngSum += Number(lng);
        latLng = createLatLngObject(lat, lng);
    } else {
        invalidLatLngCount++;
    }
    return latLng;
}

function createLatLngObject(lat, lng) {
    if (google) {
        return new google.maps.LatLng(lat, lng);
    }
}

function validateLatLng(lat, lng) {
    if (isNaN(lat) || lat === null || lat === '' || !(-90 < Number(lat) && Number(lat) < 90)) {
        return false;
    }

    if (isNaN(lng) || lng === null || lng === '' || !(-180 < Number(lng) && Number(lng) < 180)) {
        return false;
    }
    return true;
}

function normalizeLocations(dataset) {
    var _locations;
    if (_.isArray(dataset)) {
        _locations = dataset;
    } else if (_.isObject(dataset) && _.isArray(dataset.data) && !_.isEmpty(dataset.data)) {
        _locations = dataset.data;
    } else {
        _locations = dataset ? [dataset] : [];
    }
    return _locations;
}

function updateDirectionsMap() {
    var origin = Prefab.origin,
        destination = Prefab.destination,
        travelMode = Prefab.travelmode,
        showTrafficLayer = Prefab.trafficlayer,
        showTransitLayer = Prefab.transitlayer;

    if (_.isEmpty(origin) || _.isEmpty(destination) || _.isEmpty(travelMode)) {
        _refreshMap();
        return;
    }
    var map = Prefab.maps[0];
    Prefab.directionsData.origin = origin;
    Prefab.directionsData.destination = destination;
    prepareWayPoints(Prefab.waypoints, Prefab.stopover);

    addRouteMap(map, origin, destination, travelMode, Prefab.directionsData.wayPoints, showTrafficLayer, showTransitLayer);
}
_updateDirectionsMap = _.debounce(updateDirectionsMap, 50);

function addOrRemoveTrafficLayer(map, isToAdd) {
    if (isToAdd) {
        trafficLayer = new google.maps.TrafficLayer();
        trafficLayer.setMap(map);
    } else if (trafficLayer) {
        trafficLayer.setMap(null);
        trafficLayer = null;
    }
}

function addOrRemoveTransitLayer(map, isToAdd) {
    if (isToAdd) {
        transitLayer = new google.maps.TransitLayer();
        transitLayer.setMap(map);
    } else if (transitLayer) {
        transitLayer.setMap(null);
        transitLayer = null;
    }
}

function prepareWayPoints(wayPoints, stopOver) {
    var nrmWayPoints = [];
    if (!_.isArray(wayPoints) || wayPoints.length === 0) {
        return nrmWayPoints;
    }
    _.forEach(wayPoints, function (wayPoint) {
        wayPoint.stopover = stopOver;
        nrmWayPoints.push(wayPoint);
    });


    Prefab.directionsData.wayPoints = nrmWayPoints;
}

function addRouteMap(map, origin, destination, travelMode, wayPoints = [], showTraffic = false, showTransit = false) {
    directionsService = new google.maps.DirectionsService();
    directionsDisplay = new google.maps.DirectionsRenderer();

    directionsDisplay.setMap(map);

    directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: travelMode.toUpperCase(),
        waypoints: wayPoints,
        optimizeWaypoints: true

    }, function (response, status) {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
            var routes = response.routes,
                distance = 0,
                duration = 0;
            //iterate throughout the object as there might be multiple waypoints and directions on the map.
            _.forEach(routes, function (route) {
                var legs = route.legs;
                _.forEach(legs, function (leg) {
                    distance += _.get(leg, 'distance.value') || 0;
                    duration += _.get(leg, 'duration.value') || 0;
                });

            });


            distance = distance ? _.round(distance / 1000, 2) : '';
            duration = duration ? _.round(duration / 3600, 2) : '';
            Prefab.distance = distance;
            Prefab.duration = duration;
        } else {
            console.error('Directions request failed due to ' + status);
        }
    });


    addOrRemoveTrafficLayer(map, showTraffic);
    addOrRemoveTransitLayer(map, showTransit);
}

function removeRouteMap() {
    if (directionsDisplay) {
        directionsDisplay.setMap(null);
    }
}

function buildHeatMap(dataset) {
    if (!resetMap(dataset)) {
        return;
    }

    //if lat lng properties are not assigned do not construct the heatmap model
    if (!Prefab.lat || !Prefab.lng) {
        return;
    }

    var _locations = normalizeLocations(dataset);

    prepareHeatMapData(_locations);
    setCenter();
    addHeatMap(Prefab.maps[0], Prefab.heatMapData, Prefab.gradient, Prefab.pixeldensity, Prefab.opacity);
}
_buildHeatMap = _.debounce(function (locations) {
    buildHeatMap(locations);
}, 50);

function prepareHeatMapData(locations) {
    mapBounds = new google.maps.LatLngBounds();
    _.forEach(locations, function (location) {
        if (location === null || !location) {
            return;
        }

        var latitude = getValueFromObj(location, Prefab.lat);
        var longitude = getValueFromObj(location, Prefab.lng);

        var latLng = prepareLatLngData(latitude, longitude);

        if (latLng) {
            Prefab.heatMapData.push(latLng);
            mapBounds.extend(latLng);
        }
    });

}

function addHeatMap(map, locations, gradient, radius, opacity) {
    var heatMapOptions = {
        data: locations
    };


    if (gradient && _.isArray(gradient)) {
        heatMapOptions.gradient = gradient;
    }
    if (_.isNumber(radius)) {
        heatMapOptions.radius = radius;
    }
    if (_.isNumber(opacity)) {
        heatMapOptions.opacity = opacity;
    }

    heatMap = new google.maps.visualization.HeatmapLayer(heatMapOptions);
    heatMap.setMap(map);
    map.fitBounds(mapBounds);
}

function removeHeatMap() {
    if (heatMap) {
        heatMap.setMap(null);
    }
}

//handles the property value changes made to gradient,opacity, pixel density
function handleHeatMapPropChanges(key, value) {
    if (!key && heatMap) {
        heatMap.set('gradient', heatMap.get('gradient') ? null : Prefab.gradient);
        heatMap.set('opacity', heatMap.get('opacity') ? null : Prefab.opacity);
        heatMap.set('radius', heatMap.get('radius') ? null : Prefab.pixeldensity);
        return;
    }
    if (!heatMap || !value) {
        return;
    }
    if (key === 'pixeldensity') {
        key = 'radius';
    }
    heatMap.set(key, heatMap.get(key) ? null : value);
}

function buildMarkersMap(dataset) {
    if (Prefab.maptype !== 'Markers') {
        return;
    }

    if (!resetMap(dataset)) {
        return;
    }

    if (!((Prefab.markertype === 'Address' && Prefab.address) || (Prefab.markertype === 'LatLng' && Prefab.lat && Prefab.lng))) {
        return;
    }

    var _locations = normalizeLocations(dataset);
    prepareMarkersDataAndAddToMap(_locations);
}
_buildMarkersMap = _.debounce(function (locations) {
    buildMarkersMap(locations);
}, 50);

function getLatLngFromAddress(address, markerIdx) {
    if (!google || !address) {
        return;
    }

    var geoCoder = new google.maps.Geocoder();
    if (!geoCoder) {
        console.error('Geocode library does not exist');
        return false;
    }

    return new Promise(function (resolve, reject) {
        geoCoder.geocode({
            'address': address
        }, function (results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                var latitude = results[0].geometry.location.lat();
                var longitude = results[0].geometry.location.lng();
                var latLng = prepareLatLngData(latitude, longitude);
                Prefab.markersData[markerIdx].latLng = latLng;
            }
            resolve(results, status);
        });

    });

}

function prepareMarkersDataAndAddToMap(locations) {
    var markerIdx = 0;
    var fetchLatLngFromAddrPromises = [];
    var map = Prefab.maps[0];
    mapBounds = new google.maps.LatLngBounds();

    _.forEach(locations, function (location, idx) {
        if (location === null || !location) {
            return;
        }

        var markerObj = {
            icon: Prefab.icon ? getValueFromObj(location, Prefab.icon) : '',
            info: Prefab.info ? getValueFromObj(location, Prefab.info) : '',
            id: 'marker_' + idx,
            markerIdx: markerIdx,
            color: Prefab.shade ? getValueFromObj(location, Prefab.shade) : '',
            radius: Prefab.radius ? getValueFromObj(location, Prefab.radius) : ''
        };



        if (Prefab.markertype === 'Address') {
            var addressData = Prefab.address.split(' ');
            var address = '';
            _.forEach(addressData, function (addrValue, index) {
                addrValue = getValueFromObj(location, addressData[index]) + ' ';
                address += addrValue || '';
            });


            markerObj.address = address;

            var fetchLatLngPromise = getLatLngFromAddress(address, markerIdx);
            if (fetchLatLngPromise) {
                fetchLatLngFromAddrPromises.push(fetchLatLngPromise);
            }
        } else {
            var latitude = getValueFromObj(location, Prefab.lat);
            var longitude = getValueFromObj(location, Prefab.lng);
            var latLng = prepareLatLngData(latitude, longitude);
            if (latLng) {
                markerObj.latLng = latLng;
            }
        }

        Prefab.markersData.push(markerObj);
        markerIdx++;
    });


    if (fetchLatLngFromAddrPromises.length) {
        Promise.all(fetchLatLngFromAddrPromises).then(function (values) {
            _.remove(Prefab.markersData, function (marker) {
                return !marker.latLng;
            });


            setCenter();
            addMarkersToMap(map, Prefab.markersData);
            map.setZoom(Prefab.zoom);
        });

    } else {
        setCenter();
        addMarkersToMap(map, Prefab.markersData);
        map.setZoom(Prefab.zoom);
    }
}

function addMarkersToMap(map, markersData) {
    if (!map || !markersData.length) {
        return;
    }

    _.forEach(markersData, function (marker, idx) {
        if (!marker.latLng) {
            return;
        }
        var markerOptions = {
            position: marker.latLng,
            map: map
        };


        if (marker.icon) {
            markerOptions.icon = marker.icon;
        }

        var mapMarker = new google.maps.Marker(markerOptions);
        Prefab.markersData[idx].marker = mapMarker;
        mapBounds.extend(mapMarker.getPosition());

        addMarkerEvents(mapMarker, marker);

        if (marker.radius) {
            var color = marker.color ? marker.color : '#FF0000';
            var circleOptions = {
                strokeColor: color,
                strokeOpacity: 0.8,
                strokeWeight: 1,
                fillColor: color,
                map: map,
                center: marker.latLng,
                radius: marker.radius
            };


            var circleOverlay = new google.maps.Circle(circleOptions);
            Prefab.markersData[idx].circleOverlay = circleOverlay;
        }
    });


    map.fitBounds(mapBounds);
}

function addMarkerEvents(mapMarker, markerData) {
    google.maps.event.addListener(mapMarker, 'click', function (event) {
        Prefab.activeMarker = {
            'event': event,
            'marker': markerData
        };


        Prefab.showInfoWindow(event, markerData);
        if (Prefab.onMarkerclick) {
            Prefab.onMarkerclick(Prefab);
        }
    });


    google.maps.event.addListener(mapMarker, 'mouseover', function (event) {
        Prefab.activeMarker = {
            'event': event,
            'marker': markerData
        };


        if (Prefab.onMarkerhover) {
            Prefab.onMarkerhover(Prefab);
        }
    });

}

function showInfoWindow(event, marker) {
    if (!marker.info || !google || !marker.latLng) {
        return;
    }

    if (infoWindow) {
        infoWindow.close();
    }

    var content = '<div><p>' + marker.info + '</p></div>';

    infoWindow = new google.maps.InfoWindow({
        content: content,
        pixelOffset: new google.maps.Size(0, -30),
        position: marker.latLng
    });


    infoWindow.open(Prefab.maps[0]);
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

function addMarkerByUsingLatLng(lat, lng, markerId) {
    if (!Prefab.maps[0] && (!Prefab.lat || !Prefab.lng)) {
        return;
    }
    if (!validateLatLng(lat, lng)) {
        return;
    }
    //remove the previous marker only if the markerId is not provided
    clearNoIdMarker();
    var latLngObj = createLatLngObject(lat, lng);
    var marker = new google.maps.Marker({
        'position': latLngObj,
        'map': Prefab.maps[0],
        'draggable': true,
        'animation': google.maps.Animation.DROP
    });


    Prefab.maps[0].panTo(latLngObj);
    if (markerId) {
        marker.$$id = markerId.toString();
    }
    customMarkers.push(marker);
}

function addMarkerByUsingAddress(address, markerId) {
    if (!address) {
        return;
    }

    var geoCoder = new google.maps.Geocoder();
    if (!geoCoder) {
        console.error('Geocode library does not exist');
        return;
    }
    geoCoder.geocode({
        'address': address
    }, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var addrLat = results[0].geometry.location.lat();
            var addrLng = results[0].geometry.location.lng();
            addMarkerByUsingLatLng(addrLat, addrLng, markerId);
        } else {
            console.error('Geocode was not successful for the following reason: ' + status);
            return;
        }
    });

}

function removeMarkers(markerArray) { //removes all the markers if the markerArray is not passed
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

//removes the marker placed based on marker Id
function removeMarker(markerIds) {
    if (!markerIds) {
        return;
    }
    if (_.isObject(markerIds) || _.isArray(markerIds)) {
        removeMarkers(markerIds);
    } else {
        removeMarkers([markerIds]);
    }
}

Prefab.initMap = initMap;
Prefab.refresh = _refreshMap;
Prefab.redraw = _refreshMap;
Prefab.markLatLng = addMarkerByUsingLatLng;
Prefab.markAddress = addMarkerByUsingAddress;
Prefab.clearMarkers = removeMarkers;
Prefab.removeMarker = removeMarker;
Prefab.clearAllMarkers = removeMarkers;
Prefab.showInfoWindow = showInfoWindow;
Prefab.toggleLoader = toggleLoader;
