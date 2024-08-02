import { setupBenchamrking } from "./benchmarking"
import { debug, debugPanel } from "./main"
import { testConnectionSpeed } from "./wrtcBenchmarks"



document.getElementById("connectionSpeed")!.addEventListener("click", async () => {
    console.log("Clicked")
    await testConnectionSpeed()
})




export const enableDebugPanel = () => {

    const panel = document.getElementById("debugPanel")!

    panel.style.display = "block"
}
