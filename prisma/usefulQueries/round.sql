insert into "Round" (round_number, round_date, team1_id, team2_id)
values (1, CURRENT_DATE, 1, 5);
insert into "LeagueRound" (league_id, round_id)
values (1, 1);

-- List rounds with team names
SELECT r.id         AS round_id,
       r.team1_id,
       t1.team_name AS team1_name,
       r.team1_wins,
       r.team2_id,
       t2.team_name AS team2_name,
       r.team2_wins
FROM "Round" r
         JOIN "Team" t1 ON r.team1_id = t1.team_id
         JOIN "Team" t2 ON r.team2_id = t2.team_id;
