# Process flow

### 1. Pokretanje runde

- Biranje di koji igrač sijedi na UI
- Slanje tih istih igrača i porvjera postoje li ti parovi već u bazi ako ne kreira se novi par igrača
- Nakon određivanja parova igrača kreira se match

### 2. Match

- Prikaz pobjeda u runudama na vrhu
- Prikaz ukupnog score-a
- Prikaz rezulata klikom na rezultat dohvaćaju se detalji
- Gumb za upis rezulltata / završavanje matcha
  ### 2.1. Upis rezultata
  #### 2.1.1. Upis tko je zvao
    - Odabire se koji igrač ke zvao sprema samo se id, sve se sprema u storage na forntednu
    - gumbovi dalje i nazad
  #### 2.1.2. Upis zvanja
    - Odabiru se zvanja za svakog igrača pojedino, sve se sprema u storage na forntednu
  #### 2.1.3. Upis bodova igre
    - Upisuju se rezultati jednoj ekipi dok se za drugu računa automatski
    - klikom na upiši odvijaju se sljedeće stvari:
        1. Spremanje rezultata u bazu i uvećanje konačnog rezultata timova u toj partiji
        2. Provjera je li match gotovo - i to definira koji gumb se pokazuje kasnije na ekranu za match upisi ili završi
           match
        3. Restartira lokalno na frontendu podatke iz rezultata
        4. Nešto se mora desiti sa najavama, spremanje?
        5. promejna osobe koja miješa sljedeća
        6.  
