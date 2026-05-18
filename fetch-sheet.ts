async function fetchSheet() {
  const url = "https://docs.google.com/spreadsheets/d/1e_iFONEtX9CaebJuEoZx37Sdc5sI-Kr5eg34mdH4I3Q/gviz/tq?tqx=out:csv&sheet=한식";
  const res = await fetch(url);
  const text = await res.text();
  console.log(text.slice(0, 1000));
}
fetchSheet();
