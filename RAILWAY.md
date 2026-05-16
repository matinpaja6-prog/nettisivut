# Railway update -komennot

## 1. Mene projektikansioon

```powershell
cd "C:\Users\pietu\Desktop\uusi työ"
```

## 2. Tarkista että build toimii

```powershell
npm run lint
npm run build
```

## 3. Lisää muutokset gitiin

```powershell
git add .
```

## 4. Tee commit

Vaihda viesti tarvittaessa:

```powershell
git commit -m "Update listing and sell UI"
```

## 5. Pushaa GitHubiin

```powershell
git push origin main
```

## 6. Päivitä Railwayhin

Jos Railway on yhdistetty GitHubiin, Railway deployaa automaattisesti pushin jälkeen.

Jos haluat ajaa päivityksen käsin CLI:llä:

```powershell
railway up
```

## Koko lista putkeen

```powershell
cd "C:\Users\pietu\Desktop\uusi työ"
npm run lint
npm run build
git add .
git commit -m "Update listing and sell UI"
git push origin main
railway up
```

Jos Railway deployaa automaattisesti GitHubista, jätä viimeinen `railway up` pois.
