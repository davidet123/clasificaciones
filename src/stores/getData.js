import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

import Papa from 'papaparse'

export const useGetDatastore = defineStore('getData',  {
  state: () => ({
    url: 'https://www.alcanzatumeta.es/resultados-medallas.php?e=',
    num_carrera: '832006',
    datos: [],
    filtroClasificacion: ["GENERAL MASCULINA", "GENERAL FEMENINA"],
    ultimaActualizacion: null,
    todasCategorias: []
  }),
  getters: {

  },
  actions: {

    async descargarCSV(url) {
      try {
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Error al descargar: ${response.statusText}`)
        }

        // Leer el contenido como blob
        const blob = await response.blob()

        // Obtener nombre de archivo del header si está presente
        const disposition = response.headers.get('Content-Disposition')
        let filename = 'archivo.csv'

        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename="?(.+?)"?(\s*;|$)/)
          if (match && match[1]) {
            filename = match[1]
          }
        }

        // Crear enlace de descarga
        const urlBlob = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = urlBlob
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(urlBlob)

        console.log(`Archivo "${filename}" descargado correctamente.`)
      } catch (error) {
        console.error('Error al descargar el archivo CSV:', error)
      }
    },
    async cargarCSV() {
      const url = this.url + this.num_carrera
      try {
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`Error al descargar: ${response.statusText}`)
        }

        const csvText = await response.text()

        // Usamos PapaParse para convertir el CSV a array de objetos
        const parsed = Papa.parse(csvText, {
          header: true, // Usa la primera fila como nombres de columna
          skipEmptyLines: true
        })

        this.datos = parsed.data.map(el => {
          const corredor = {}
          corredor.nombre = el["NOMBRE Y APELLIDOS"]
          corredor.dorsal = el["DORSAL"]
          corredor.meta = el["TIEMPO OFICIAL"]
          corredor.categoria = el["CAT."]
          corredor.sexo = el["SEXO"]

          return corredor
        })
        
        this.datos.forEach(el => {
          if(!this.todasCategorias.includes(el.categoria)) this.todasCategorias.push(el.categoria)

        })
        
        this.ultimaActualizacion = this.obtenerHoraActual()
        console.log('Datos CSV cargados en el store:', this.datos)
      } catch (error) {
        console.error('Error al cargar el archivo CSV:', error)
      }
    },
    obtenerHoraActual() {
      const ahora = new Date();
      const horas = String(ahora.getHours()).padStart(2, '0');
      const minutos = String(ahora.getMinutes()).padStart(2, '0');
      const segundos = String(ahora.getSeconds()).padStart(2, '0');
      return `${horas}:${minutos}:${segundos}`;
    }
   
  }
})
