console.log("This script runs!")


// send cookies to /cookies and log the cookies returned
async function sendCookies() {
    let response = await fetch('/cookies', {
        method: 'GET',
        credentials: 'include'
    })

    console.log(response)
}

sendCookies()