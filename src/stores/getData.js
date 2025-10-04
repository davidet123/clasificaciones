import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

import Papa from 'papaparse'
// import { consoleError } from 'vuetify/lib/util'

export const useGetDatastore = defineStore('getData',  {
  state: () => ({
    url: 'https://www.alcanzatumeta.es/resultados-medallas.php?e=',
    urlCopernico: [
      {
        tipo: 'male',
        url: 'https://public-api.copernico.cloud/api/races/gran-fondo-internacional-de-7-aguas-2025/leaders/Gran%20Fondo/gender:male?fields=nationality'
      },
      {
        tipo: 'female',
        url: 'https://public-api.copernico.cloud/api/races/gran-fondo-internacional-de-7-aguas-2025/leaders/Gran%20Fondo/gender:female?fields=nationality'
      },
    ],
    fileURL: '/public/inscritos_ibi.csv',
    // https://www.alcanzatumeta.es/resultados-medallas.php?e=1002805
    // num_carrera: '832006',
    num_carrera: '1002805',
    urlCSV: 'http://localhost:3500/csv',
    datos: [],
    splits: ['CP1', 'Vuelta Meta', 'CP2', 'Vuelta CP1', 'Meta'],
    testDatos: [
      {
        tipo: 'male',
        listado: 
        [
          {
            "id": "8faf28d1-2d44-5a68-9539-f8cbc6206b0d",
            "dorsal": "99999",
            "time": 3960000,
            "name": "Dorsal",
            "surname": "Prueba",
            "club": "",
            "category": "Senior M",
            "average": 0.26139,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039160000,
            "pos": 1,
            "nationality": "ESP"
          },
          {
            "id": "a3b5c7d9-e1f3-4a6b-8c2d-0e4f6g7h8i9j",
            "dorsal": "10001",
            "time": 3972000,
            "name": "Carlos",
            "surname": "García",
            "club": "Atletismo Madrid",
            "category": "Senior M",
            "average": 0.26215,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039172000,
            "pos": 2,
            "nationality": "ESP"
          },
          {
            "id": "b4c6d8e0-f2g4-5h7i-9j1k-3l5m7n9o1p3q",
            "dorsal": "10002",
            "time": 3985000,
            "name": "Javier",
            "surname": "López",
            "club": "Valencia Running",
            "category": "Senior M",
            "average": 0.26302,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039185000,
            "pos": 3,
            "nationality": "ESP"
          },
          {
            "id": "c5d7e9f1-g3h5-6i8j-0k2l-4m6n8o0p2q4r",
            "dorsal": "10003",
            "time": 3998000,
            "name": "Miguel",
            "surname": "Rodríguez",
            "club": "Barcelona Athletics",
            "category": "Senior M",
            "average": 0.26389,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039198000,
            "pos": 4,
            "nationality": "ESP"
          },
          {
            "id": "d6e8f0g2-h4i6-7j9k-1l3m-5n7o9p1q3r5s",
            "dorsal": "10004",
            "time": 4012000,
            "name": "Alejandro",
            "surname": "Martínez",
            "club": "Sevilla Corre",
            "category": "Senior M",
            "average": 0.26481,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039212000,
            "pos": 5,
            "nationality": "ESP"
          },
          {
            "id": "e7f9g1h3-i5j7-8k0l-2m4n-6o8p0q2r4s6t",
            "dorsal": "10005",
            "time": 4026000,
            "name": "Daniel",
            "surname": "Sánchez",
            "club": "Málaga Runners",
            "category": "Senior M",
            "average": 0.26574,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039226000,
            "pos": 6,
            "nationality": "ESP"
          },
          {
            "id": "f8g0h2i4-j6k8-9l1m-3n5o-7p9q1r3s5t7u",
            "dorsal": "10006",
            "time": 4041000,
            "name": "Pablo",
            "surname": "Fernández",
            "club": "Bilbao Atletismo",
            "category": "Senior M",
            "average": 0.26672,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039241000,
            "pos": 7,
            "nationality": "ESP"
          },
          {
            "id": "g9h1i3j5-k7l9-0m2n-4o6p-8q0r2s4t6u8v",
            "dorsal": "10007",
            "time": 4057000,
            "name": "Adrián",
            "surname": "Gómez",
            "club": "Zaragoza Deporte",
            "category": "Senior M",
            "average": 0.26775,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039257000,
            "pos": 8,
            "nationality": "ESP"
          },
          {
            "id": "h0i2j4k6-l8m0-1n3o-5p7q-9r1s3t5u7v9w",
            "dorsal": "10008",
            "time": 4073000,
            "name": "Sergio",
            "surname": "Díaz",
            "club": "Granada Running",
            "category": "Senior M",
            "average": 0.26879,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039273000,
            "pos": 9,
            "nationality": "ESP"
          },
          {
            "id": "i1j3k5l7-m9n1-2o4p-6q8r-0s2t4u6v8w0x",
            "dorsal": "10009",
            "time": 4090000,
            "name": "Raúl",
            "surname": "Hernández",
            "club": "Valladolid Athletics",
            "category": "Senior M",
            "average": 0.26989,
            "split": "CP1",
            "location": "Meta",
            "rawTime": 1754039290000,
            "pos": 10,
            "nationality": "ESP"
          }
        ]

      },
      {
        tipo: 'female',
        listado:
        [
          {
            "id": "j2k4l6m8-n0o2-3p5q-7r9s-1t3u5v7w9x1y",
            "dorsal": "20001",
            "time": 4120000,
            "name": "Laura",
            "surname": "González",
            "club": "Madrid Running",
            "category": "Senior F",
            "average": 0.27189,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039320000,
            "pos": 1,
            "nationality": "ESP"
          },
          {
            "id": "k3l5m7n9-o1p3-4q6r-8s0t-2u4v6w8x0y2z",
            "dorsal": "20002",
            "time": 4138000,
            "name": "Marta",
            "surname": "Rodríguez",
            "club": "Barcelona Athletics",
            "category": "Senior F",
            "average": 0.27302,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039338000,
            "pos": 2,
            "nationality": "ESP"
          },
          {
            "id": "l4m6n8o0-p2q4-5r7s-9t1u-3v5w7x9y1z3a",
            "dorsal": "20003",
            "time": 4157000,
            "name": "Elena",
            "surname": "Martínez",
            "club": "Valencia Runners",
            "category": "Senior F",
            "average": 0.27421,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039357000,
            "pos": 3,
            "nationality": "ESP"
          },
          {
            "id": "m5n7o9p1-q3r5-6s8t-0u2v-4w6x8y0z2a4b",
            "dorsal": "20004",
            "time": 4176000,
            "name": "Ana",
            "surname": "Sánchez",
            "club": "Sevilla Corre",
            "category": "Senior F",
            "average": 0.27539,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039376000,
            "pos": 4,
            "nationality": "ESP"
          },
          {
            "id": "n6o8p0q2-r4s6-7t9u-1v3w-5x7y9z1a3b5c",
            "dorsal": "20005",
            "time": 4196000,
            "name": "Sara",
            "surname": "López",
            "club": "Málaga Atletismo",
            "category": "Senior F",
            "average": 0.27664,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039396000,
            "pos": 5,
            "nationality": "ESP"
          },
          {
            "id": "o7p9q1r3-s5t7-8u0v-2w4x-6y8z0a2b4c6d",
            "dorsal": "20006",
            "time": 4217000,
            "name": "Carmen",
            "surname": "Fernández",
            "club": "Bilbao Running",
            "category": "Senior F",
            "average": 0.27795,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039417000,
            "pos": 6,
            "nationality": "ESP"
          },
          {
            "id": "p8q0r2s4-t6u8-9v1w-3x5y-7z9a1b3c5d7e",
            "dorsal": "20007",
            "time": 4239000,
            "name": "Isabel",
            "surname": "Gómez",
            "club": "Zaragoza Deporte",
            "category": "Senior F",
            "average": 0.27932,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039439000,
            "pos": 7,
            "nationality": "ESP"
          },
          {
            "id": "q9r1s3t5-u7v9-0w2x-4y6z-8a0b2c4d6e8f",
            "dorsal": "20008",
            "time": 4262000,
            "name": "Paula",
            "surname": "Díaz",
            "club": "Granada Athletics",
            "category": "Senior F",
            "average": 0.28079,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039462000,
            "pos": 8,
            "nationality": "ESP"
          },
          {
            "id": "r0s2t4u6-v8w0-1x3y-5z7a-9b1c3d5e7f9g",
            "dorsal": "20009",
            "time": 4286000,
            "name": "Cristina",
            "surname": "Hernández",
            "club": "Valladolid Runners",
            "category": "Senior F",
            "average": 0.28232,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039486000,
            "pos": 9,
            "nationality": "ESP"
          },
          {
            "id": "s1t3u5v7-w9x1-2y4z-6a8b-0c2d4e6f8g0h",
            "dorsal": "20010",
            "time": 4311000,
            "name": "Nuria",
            "surname": "Jiménez",
            "club": "Girona Atletismo",
            "category": "Senior F",
            "average": 0.28395,
            "split": "Meta",
            "location": "Meta",
            "rawTime": 1754039511000,
            "pos": 10,
            "nationality": "ESP"
          }
        ]

      }

    ],
    filtroClasificacion: ["GENERAL MASCULINA", "GENERAL FEMENINA"],
    ultimaActualizacion: null,
    todasCategorias: [],
    pruebas: [],
    inscritos: null,
    pruebaFiltrada: '10K'
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
        // console.log(this.parsed.data)

        this.datos = parsed.data.map(el => {
          // console.log(el["P.CAT."])
          // console.log(el["PRUEBA\r"])
          const corredor = {}
          corredor.nombre = el["NOMBRE Y APELLIDOS"]
          corredor.dorsal = el["DORSAL"]
          corredor.meta = el["TIEMPO OFICIAL"]
          corredor.categoria = el["CAT."]
          corredor.sexo = el["SEXO"]
          corredor.prueba = el["PRUEBA\r"]
          corredor.posicion = el["P.CAT."]

          return corredor
        })
        this.datos = this.datos.filter(el => el.posicion !== '-')
        
        this.datos.forEach(el => {
          if(!this.todasCategorias.includes(el.categoria)) this.todasCategorias.push(el.categoria)
          if(!this.pruebas.includes(el.prueba)) this.pruebas.push(el.prueba)

        })
        console.log(this.pruebas)
        this.ultimaActualizacion = this.obtenerHoraActual()
        console.log('Datos CSV cargados en el store:', this.datos)
      } catch (error) {
        console.error('Error al cargar el archivo CSV:', error)
      }
    },
    async cargarDesdeURL() {
      try {
        const response = await fetch(this.fileURL)
        const text = await response.text()

        const parsed = Papa.parse(text, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        })
        // const parsed = Papa.parse(text, {
        //   header: true,
        //   delimiter: ';',
        //   skipEmptyLines: true,
        //   complete: (result) => {
        //     this.inscritos = result.data
            
        //   },
        //   error: (err) => {
        //     console.error('Error al parsear CSV:', err)
        //   }
        // })
        this.inscritos = parsed.data.map(el => {
          const corredor = {}
          // console.log(el)

          corredor.nombre = `${el.Nombre} ${el.Apellidos}`
          corredor.dorsal = el.Dorsal
          // corredor.meta = el["TIEMPO OFICIAL"]
          corredor.categoria = el["Cat."]
          corredor.prueba = el.Prueba
          // corredor.sexo = el["SEXO"]
          // console.log(el)

          return corredor
        })
      } catch (error) {
        console.error('Error al cargar archivo:', error)
      }
      console.log(this.inscritos)
    },
    async cargarCSVLocal() {
      try {
        const response = await fetch(this.urlCSV)
        const text = await response.text()

        const parsed = Papa.parse(text, {
          header: true,
          delimiter: ';',
          skipEmptyLines: true,
        })
        console.log(parsed)
        // const parsed = Papa.parse(text, {
        //   header: true,
        //   delimiter: ';',
        //   skipEmptyLines: true,
        //   complete: (result) => {
        //     this.inscritos = result.data
            
        //   },
        //   error: (err) => {
        //     console.error('Error al parsear CSV:', err)
        //   }
        // })
        // this.inscritos = parsed.data.map(el => {
        //   const corredor = {}
        //   // console.log(el)

        //   corredor.nombre = `${el.Nombre} ${el.Apellidos}`
        //   corredor.dorsal = el.Dorsal
        //   // corredor.meta = el["TIEMPO OFICIAL"]
        //   corredor.categoria = el["Cat."]
        //   corredor.prueba = el.Prueba
        //   // corredor.sexo = el["SEXO"]
        //   // console.log(el)

        //   return corredor
      //   })
      } catch (error) {
        console.error('Error al cargar archivo:', error)
      }
      // console.log(this.inscritos)
    },
    obtenerHoraActual() {
      const ahora = new Date();
      const horas = String(ahora.getHours()).padStart(2, '0');
      const minutos = String(ahora.getMinutes()).padStart(2, '0');
      const segundos = String(ahora.getSeconds()).padStart(2, '0');
      return `${horas}:${minutos}:${segundos}`;
    },
    async getDataCopernico() {

      let datos = [] // datos convertidos
      let datosServidor = [] // datos actualizados

      // for (const lista of this.urlCopernico) {
      //   const res = await axios.get(lista.url)
      //   res.data.data.map(el => el.tipo = lista.tipo)
        
        
      //   datosServidor = datosServidor.concat(res.data.data)
      //   }
      //   console.log(datosServidor)
    
      
      
      for(const lista of this.testDatos) {
        lista.listado.map(el => el.tipo = lista.tipo)
         
        datosServidor = datosServidor.concat(lista.listado)
      }

      if(localStorage.getItem('listadoCorredores') === null) {
        const temp = []

        for(const el of datosServidor) {
        const corredor = {
          id: el.id,
          nombre: `${el.name} ${el.surname}`,
          dorsal: el.dorsal,
          tiempos: {},
          pais: el.nationality,
          categoria: el.tipo,
          pos: el.pos

          }
          datos.push(corredor)
          console.log(datos)
        }
        localStorage.setItem('listadoCorredores', JSON.stringify(datos))
      } else {
        datos = JSON.parse(localStorage.getItem('listadoCorredores'))
      }
      console.table(datos)

      datosServidor.forEach(corredorServidor => {
        const corredorLocal = datos.find(el => el.id === corredorServidor.id)
        
        if (corredorLocal) {
            // Actualizar tiempo en el split correspondiente
            corredorLocal.tiempos[corredorServidor.split] = corredorServidor.time
            
            // También actualizar otros datos que puedan haber cambiado
            corredorLocal.pos = corredorServidor.pos
        } else {
            // Si el corredor no existe en localStorage, agregarlo
            const nuevoCorredor = {
                id: corredorServidor.id,
                nombre: `${corredorServidor.name} ${corredorServidor.surname}`,
                dorsal: corredorServidor.dorsal,
                tiempos: {
                    [corredorServidor.split]: corredorServidor.time
                },
                pais: corredorServidor.nationality,
                categoria: corredorServidor.tipo,
                pos: corredorServidor.pos
            };
            nuevoCorredor.tiempos[corredorServidor.split] = corredorServidor.time;
            datos.push(nuevoCorredor);
        }
    })
    localStorage.setItem('listadoCorredores', JSON.stringify(datos))
    
    console.log('Datos guardados:', datos[0])
    console.log('Guardado en localStorage:', JSON.parse(localStorage.getItem('listadoCorredores'))[0])
    this.datos = datos
      

      
      


      // for (const lista of this.urlCopernico) {
      //   console.log(lista)
      //   const res = await axios.get(lista.url)


      //   this.datosServidor.push({
      //     tipo: lista.nombre,
      //     listado: res.data.data
      //   })
      // }

      // console.log(this.datos)


    },
    crearListadoInicial(lista) {
      let listaTemp = []
      for(const el of lista.listado) {
        const corredor = {
          id: el.id,
          nombre: `${el.name} ${el.surname}`,
          dorsal: el.dorsal,
          tiempos: [],
          pais: el.nationality,
          categoria: lista.tipo,
          pos: el.pos

        }
        listaTemp.push(corredor)
      }
      return listaTemp
    }
   
  }
})
