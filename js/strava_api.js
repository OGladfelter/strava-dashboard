strava_data = [];

///////////////////////////////////// API token setting up ///////////////////////////////////////////////////
// check for URL params
var queryString = window.location.search;

// search local storage for a possible access token
try{
    var token_exists = JSON.parse(localStorage.getItem("strava_data")).access_token != null;
    var expires_at = JSON.parse(localStorage.getItem("strava_data")).expires_at;
}
catch{
    var token_exists = false;
    var expires_at = 0;
}

// 4 possible scenarios: token in local storage, expired token in local storage, no token and no oauth code, no token but oauth code
if (token_exists & (new Date().getTime() / 1000) < expires_at) { // their access token is saved in local storage and hasn't expired yet
    console.log("Token exists");

    updateAthleteInfo(JSON.parse(localStorage.getItem("strava_data")).athlete);

    token = JSON.parse(window.localStorage.getItem("strava_data")).access_token;
    getActivities(1);
}
else if (token_exists & (new Date().getTime() / 1000) >= expires_at) { // their access token is saved in local storage but expired
    console.log("Previous authorization detected; access token is expired");

    updateAthleteInfo(JSON.parse(localStorage.getItem("strava_data")).athlete);
    
    var refreshToken = JSON.parse(localStorage.getItem("strava_data")).refresh_token;
    reAuthorize(refreshToken);
}
else if (queryString == "" || queryString == "?state=&error=access_denied"){ // we don't have a code. They still need to log in and authorize
    // encourage them to log in and authorize
    console.log("No token in local storage, no authorization code");
    //document.getElementById("logInModal").style.display = "block";
}
else{ // we have a code because they logged in and authorized. the code can be found in the URL params
    console.log("Authorization code retrieved");

    var urlParams = new URLSearchParams(queryString);
    var code = urlParams.get('code');
    get_token();
}

////////////////////////////////// the functions /////////////////////////////////////////////////////////////
function get_token(){

    // use code from authorization to get user token
    $.ajax({
        url: 'oauth.php',
        type: "POST",
        dataType:'json', 
        data: ({'code':code}),
        complete: function(resp){
            response = resp.responseText;

            // response came in string with a weird '1' in the last position
            response = response.slice(0,-1);

            // save data to local storage - important for refresh token in the future for reauthorization
            localStorage.setItem("strava_data", response);

            // convert string to json
            response = JSON.parse(response);

            // save token
            token = response.access_token;

            // get 30 activities
            getActivities(1);   
        }
    });

}

function reAuthorize(refreshToken){

    // use code from authorization to get user token
    $.ajax({
        url: 'reoauth.php',
        type: "POST",
        dataType:'json', 
        data: ({'refreshToken':refreshToken}),
        complete: function(resp){
            response = resp.responseText;

            // response came in string with a weird '1' in the last position
            response = JSON.parse(response.slice(0,-1));

            // save token
            token = response.access_token;

            // get 30 activities
            getActivities(1);
        }
    });  
}

function getActivities(pageNum){
    
    document.getElementById("intro").style.display = 'none';
    document.getElementById("loader").style.display = 'block';

    console.log(pageNum);

    const activities_link = `https://www.strava.com/api/v3/activities?per_page=200&access_token=` + token + "&page=" + pageNum;
    fetch(activities_link)
    .then(response => response.json())
    .then((json) => {

        // if this page had 200 activities, then there's likely another page
        if (json.length == 200){
            strava_data = strava_data.concat(json); // save contents from this page, run another call to the next page
            getActivities(pageNum + 1); // recursion!!
        }
        else if (json.length < 200){ // we've reached the final page
            strava_data = strava_data.concat(json); // save final page's activities to main data array and move on

            // some data prep
            strava_data.forEach(function(d){ 
                d.year = d.start_date.slice(0,4);
                d.miles = +d.distance / 1609.34; 
            });

            // sort data by date in chronological order here - using id, as every subsequent activity has a higher ID
            //strava_data = strava_data.sort(function (a,b) {return d3.ascending(a.id, b.id); });
            strava_data = strava_data.reverse(); // reverse data since it came through in reverse-chronoligcal order

            console.log(strava_data);

            renderDashboard(strava_data);
        }
    })
}

function updateAthleteInfo(data){
    document.getElementById("name").innerHTML = data['firstname'] + "'s Strava activity visualized";
    document.getElementById("profile_picture").src = data['profile_medium'];
}

function renderDashboard(activityData) {

    // add tooltip
    tooltip = d3.select("body")
      .append("div")
      .style('visibility', 'hidden')
      .attr('class', 'tooltip')
      .style("pointer-events", "none");
     
    const data = JSON.parse(JSON.stringify(activityData));

    data.forEach(function(d){ 
        d.summary_polyline = d.map.summary_polyline;
    });

     // create array of all unique activity types in user's data and add each to dropdown filter
     activityTypes = d3.map(data, function(d){return d.type;}).keys();
     document.getElementById("dropdownButton").innerHTML = activityTypes.length + " activity types";
     if (activityTypes.length == 1) {
         // hide filter
         document.getElementById("activitiesFilter").style.display = "none";
     }
     else {
         activityTypes.forEach(function(activity) {
            addFilterOption(activity);
         });
     }

    const activityDataThisYear = data.filter(function(d){ return d.year == new Date().getFullYear().toString() });

    // center map on start location of their most recent activity
    map.panTo(new L.LatLng(data[data.length-1].start_latitude, data[data.length-1].start_longitude));

    mileagePlot(data);
    if (activityDataThisYear.length > 1) {
        lineplot(activityDataThisYear);
    }
    else {
        document.getElementById("goalTracker").style.display = 'none';
    }
    drawBeeswarm(data);

    document.getElementById("playButton").addEventListener("click", function() {
        d3.select("#heatmap").selectAll('path').remove();
        animateHeatmap(data);
    });
    document.getElementById("skipButton").addEventListener("click", function() {
        d3.select("#heatmap").selectAll('path').remove();
        animateHeatmap(data, 'Y');
        clearTimeout(timer);
        enableZoom();
    });

    document.getElementById("loader").style.display = 'none';
    document.getElementById("dashboard").style.visibility = 'visible';
}

function filterActivityType(input, activity) {
    if (input.checked) { // if box is checked, add activity from activityTypes
        activityTypes.push(activity);
    } 
    else { // if box is unchecked, remove activity from activityTypes
        const index = activityTypes.indexOf(activity);
        if (index > -1) {
            activityTypes.splice(index, 1);
        }
    }

    if (activityTypes.length == "1") {
        document.getElementById("dropdownButton").innerHTML = activityTypes[0].replace(/([A-Z])/g, " $1");
    }
    else {
        document.getElementById("dropdownButton").innerHTML = activityTypes.length + " activity types";
    }
}

function addFilterOption(activity) {
    var div = document.getElementById("activityMenu");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = activity + "Box";
    input.name = activity + "Name";
    input.value = activity;
    input.checked = true;

    var label = document.createElement("label");
    label.for = activity + "Name";
    label.id = activity + "BoxLabel";
    label.innerHTML = activity.replace(/([A-Z])/g, " $1");
    label.style.pointerEvents = 'none';

    var container = document.createElement("div");
    container.classList.add("checkboxContainer");
    container.appendChild(input);
    container.appendChild(label);

    input.addEventListener("click", function(event) {
        filterActivityType(input, activity);
        event.stopPropagation();
    });
    container.addEventListener("click", function() {
        input.checked ? input.checked = false : input.checked = true;
        filterActivityType(input, activity);
    });
    div.appendChild(container);
}

// for local development
d3.json("data.json", function(error, data) {
    data = data.reverse();
    console.log(data);
    renderDashboard(data);
});