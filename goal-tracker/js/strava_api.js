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

            // update front end stuff with their profile info
            updateAthleteInfo(response.athlete);

            // get 30 activities
            getActivities();   
        }
    });

}

//  THIS NEEDS TO BE IN PHP TO HIDE MY CLIENT SECRET TOO
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
            getActivities();
            
        }
    });  
}

function updateAthleteInfo(data){
    document.getElementById("name").innerHTML = data['firstname'] + "'s 2021 Mileage";
    document.getElementById("profile_picture").src = data['profile_medium'];
}

function getActivities() {

    document.getElementById("loader").style.display = 'block';
    
    const activities_link = `https://www.strava.com/api/v3/activities?per_page=200&access_token=` + token;
    fetch(activities_link)
    .then(response => response.json())
    .then((json) => {
        activityData = json;
        
        // some data prep
        activityData.forEach(function(d){ 
            d.year = d.start_date.slice(0,4);
            d.miles = +d.distance / 1609.34; 
        })

        renderDashboard(activityData);
    })
}

function renderDashboard(activityData) {
    mileagePlot(JSON.parse(JSON.stringify(activityData)));
    const activityDataThisYear = JSON.parse(JSON.stringify(activityData.filter(function(d){ return d.year == new Date().getFullYear().toString() })));
    lineplot(activityDataThisYear);
    document.getElementById("loader").style.display = 'none';
}

// for local development
d3.json("data.json", function(error, data) {
    renderDashboard(data);
});

///////////////////////////////////// API token setting up ///////////////////////////////////////////////////
// check for URL params
var queryString = window.location.search;

// search local storage for a possible access token
try {
    var token_exists = JSON.parse(localStorage.getItem("strava_data")).access_token != null;
    var expires_at = JSON.parse(localStorage.getItem("strava_data")).expires_at;
}
catch {
    var token_exists = false;
    var expires_at = 0;
}

// 4 possible scenarios: token in local storage, expired token in local storage, no token and no oauth code, no token but oauth code
if (token_exists & (new Date().getTime() / 1000) < expires_at) { // their access token is saved in local storage and hasn't expired yet
    console.log("Token exists");
    token = JSON.parse(window.localStorage.getItem("strava_data")).access_token;
    
    updateAthleteInfo(JSON.parse(localStorage.getItem("strava_data")).athlete);

    getActivities();
}
else if (token_exists & (new Date().getTime() / 1000) >= expires_at) { // their access token is saved in local storage but expired
    console.log("Previous authorization detected; access token is expired");
    
    updateAthleteInfo(JSON.parse(localStorage.getItem("strava_data")).athlete);

    var refreshToken = JSON.parse(localStorage.getItem("strava_data")).refresh_token;
    reAuthorize(refreshToken);
}
else if (queryString == ""){ // we don't have a code. They still need to log in and authorize
    // encourage them to log in and authorize
    console.log("No token in local storage, no authorization code");
}
else{ // we have a code because they logged in and authorized. the code can be found in the URL params
    console.log("Authorization code retrieved")
    var urlParams = new URLSearchParams(queryString);
    var code = urlParams.get('code')
    get_token();
}