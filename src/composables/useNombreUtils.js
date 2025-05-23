export const useNombreUtils = () => {
  const quitarUltimoApellido = (nombreCompleto) => {
    const partes = nombreCompleto.trim().split(/\s+/)
    return partes.length <= 2
      ? nombreCompleto.trim()
      : partes.slice(0, -1).join(' ')
  }

  return {
    quitarUltimoApellido
  }
}