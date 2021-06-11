const createTemplate=data=>{
    let genres=[];
    if(data.show.genres.length){
        genres=data.show.genres.reduce((acc,element)=>{
            return acc+", "+element;
        })
    }else{
        genres='unknown';
    }
    return `
        <div class="movie-item">
            <div class="image">
                <img src="${data.show.image ? data.show.image.medium : ''}" alt="">
            </div>
            <div><span>Name: </span>${data.show.name}</div>
            <div><span>Rating: </span>${data.show.rating.average}</div>
            <div><span>Genres: </span>${genres}</div>
            <div><span>Description: </span>${data.show.summary ? data.show.summary : 'none' }</div>
        </div>
    `
}
function clearContent(){
    document.getElementById("data-wrapper").innerHTML="";
    document.getElementById("upcoming").value="";
}

function getMovies(){
    var url="http://api.tvmaze.com/search/shows?q=";
    url+=document.getElementById("upcoming").value;
    clearContent();
    fetch(url)
        .then(response=>response.json())
        .then(data=>{
            if(data){
                ;data.forEach(element => {
                    document.getElementById("data-wrapper").innerHTML+=createTemplate(element);
                });
            }
        })
}

