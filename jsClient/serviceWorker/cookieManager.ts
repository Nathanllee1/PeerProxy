import cookie from "cookie"

class Cookies {

    cookies: Record<string, Record<string, string>> = {}

    reservedHeaders = ["domain", "encode", "expires", "httponly", "maxage", "partitioned", "path"]

    setCookie(cookieString: string) {
        const parsedCookie = cookie.parse(cookieString)

        for (const key in parsedCookie) {
            if (this.reservedHeaders.includes(key.toLowerCase())) {
                continue
            }

            this.cookies[key] = parsedCookie
        }
    }

    getCookies(domain: string | undefined) {
        return Object.keys(this.cookies)
            
        .map(name => cookie.serialize(name, this.cookies[name][name]))
        .reduce((acc, storedCookie) => `${acc} ${storedCookie};`, "")
    }

    resetCookies() {
        this.cookies = {}
    }

}

export const cookieManager = new Cookies()