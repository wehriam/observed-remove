//      

let idCounter = 0;

module.exports = ()        => {
  const normalizedDateString = Date.now().toString(36).padStart(9, '0');
  const idCounterString = idCounter.toString(36).padStart(2, '0');
  const randomString = Math.round(Number.MAX_SAFE_INTEGER / 2 + Number.MAX_SAFE_INTEGER * Math.random() / 2).toString(36);
  const id = (`${normalizedDateString}${idCounterString}${randomString}`).slice(0, 16);
  idCounter += 1;
  if (idCounter > 1295) {
    idCounter = 0;
  }
  return id;
};
