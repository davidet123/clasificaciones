import { usevMixStore } from "@/stores/vMix"
const vMixStore = usevMixStore()
console.log(vMixStore)


export const useEnvioClasificacionesVMix = () => {
  const envioClasificacionesvMix = async (listado, nombreClasificacion, input, filas) => {

    vMixStore.liveUpdate(input, "CLAS_CATEGORIA", "CLASIFICACION " + nombreClasificacion)

    for(let i = 1; i <= filas ; i++) {      
      // LIMPIAR CLASIFICACIONES
      vMixStore.liveUpdate(input, `NUM_CLAS${i}`, "")
      vMixStore.liveUpdate(input, `NOMBRE_CLAS${i}`, "")
      vMixStore.liveUpdate(input, `TIEMPO_CLAS${i}`, "")
    }
    let orden = 1
    for(let i = 0; i < filas; i++) {      
      // LIMPIAR CLASIFICACIONES
      let nombre = listado[i].nombre
      if(filas == 5) nombre = quitarUltimoApellido(listado[i].nombre)

      console.log(orden)
      vMixStore.liveUpdate(input, `NUM_CLAS${orden}`, orden)
      await vMixStore.wait(50)
      vMixStore.liveUpdate(input, `NOMBRE_CLAS${orden}`, nombre)
      await vMixStore.wait(50)
      vMixStore.liveUpdate(input, `TIEMPO_CLAS${orden}`, listado[i].meta)
      await vMixStore.wait(50)
      orden ++
    }

  }

  return {
    envioClasificacionesvMix
  }
}