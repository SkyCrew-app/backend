import { DataSource } from 'typeorm';
import { Article } from '../../modules/article/entity/article.entity';

export const seedDemoArticles = async (
  dataSource: DataSource,
): Promise<void> => {
  const articleRepository = dataSource.getRepository(Article);

  const now = new Date();

  const demoArticles = [
    {
      title: 'Bienvenue aux nouvelles recrues de la saison !',
      description: 'Le club accueille 5 nouveaux élèves pilotes pour cette saison. Découvrez le programme de formation.',
      text: `<h2>Nouveaux membres</h2>
<p>Nous sommes ravis d'accueillir 5 nouveaux élèves pilotes au sein du SkyCrew Aviation Club cette saison. Ils débutent leur formation PPL avec nos instructeurs Marie Laurent et Camille Petit.</p>
<h3>Programme de formation</h3>
<p>Le cursus PPL comprend :</p>
<ul>
<li>45 heures de vol minimum dont 25h en double commande</li>
<li>10 heures de vol solo supervisé</li>
<li>Formation théorique (météorologie, navigation, réglementation)</li>
<li>Examen théorique DGAC</li>
<li>Épreuve pratique en vol</li>
</ul>
<p>Nous leur souhaitons de beaux vols et un apprentissage serein !</p>`,
      tags: ['formation', 'nouveaux-membres', 'PPL'],
    },
    {
      title: 'Journée portes ouvertes - Samedi 15 avril',
      description: 'Le club organise une journée portes ouvertes avec baptêmes de l\'air et démonstrations.',
      text: `<h2>Journée Portes Ouvertes</h2>
<p>Le SkyCrew Aviation Club ouvre ses portes au public le samedi 15 avril. Au programme :</p>
<ul>
<li><strong>10h-12h :</strong> Visite du hangar et présentation de la flotte</li>
<li><strong>12h-14h :</strong> Barbecue convivial (participation libre)</li>
<li><strong>14h-17h :</strong> Baptêmes de l'air (30€ les 20 minutes)</li>
<li><strong>15h :</strong> Démonstration de voltige par l'équipe régionale</li>
</ul>
<p>Venez nombreux, en famille ou entre amis ! Parking gratuit sur place.</p>
<p><em>En cas de météo défavorable, les baptêmes seront reportés au dimanche 16 avril.</em></p>`,
      tags: ['événement', 'portes-ouvertes', 'baptême'],
      eventDate: new Date(now.getFullYear(), 3, 15, 10, 0),
    },
    {
      title: 'Nouveau Diamond DA40 NG dans la flotte !',
      description: 'Le club fait l\'acquisition d\'un Diamond DA40 NG, un avion moderne et performant.',
      text: `<h2>Un nouvel appareil rejoint notre flotte</h2>
<p>Nous avons le plaisir d'annoncer l'arrivée du <strong>Diamond DA40 NG</strong> (immatriculation F-HTBA) dans notre flotte !</p>
<h3>Caractéristiques</h3>
<ul>
<li>Moteur diesel Austro Engine AE300 (168 ch)</li>
<li>Consommation réduite : 25 L/h de JET-A1</li>
<li>Avionique Garmin G1000 NXi</li>
<li>Vitesse de croisière : 145 kt</li>
<li>Autonomie : 5h30</li>
</ul>
<p>Cet appareil sera disponible pour les pilotes titulaires d'une qualification SEP et ayant effectué une transition avec un instructeur du club.</p>
<p>Tarif horaire : <strong>210€/h</strong></p>`,
      tags: ['flotte', 'nouvel-avion', 'DA40'],
    },
    {
      title: 'Rappel : procédures de sécurité mises à jour',
      description: 'Suite aux recommandations du BEA, les procédures de sécurité du club ont été actualisées.',
      text: `<h2>Mise à jour des procédures de sécurité</h2>
<p>Suite aux dernières recommandations du Bureau d'Enquêtes et d'Analyses (BEA), nous avons mis à jour plusieurs procédures :</p>
<h3>Changements principaux</h3>
<ol>
<li><strong>Briefing météo obligatoire</strong> : consultation du METAR/TAF avant chaque vol, même local</li>
<li><strong>Check-list électronique</strong> : utilisation obligatoire de la check-list numérique SkyCrew</li>
<li><strong>Report d'incident</strong> : tout événement inhabituel doit être signalé dans les 24h via l'application</li>
<li><strong>Minima météo club</strong> : visibilité ≥ 5km et plafond ≥ 1500ft pour les vols VFR</li>
</ol>
<p>Ces procédures sont applicables immédiatement. En cas de doute, contactez un instructeur.</p>`,
      tags: ['sécurité', 'procédures', 'BEA'],
    },
    {
      title: 'Résultats du rallye aérien inter-clubs',
      description: 'L\'équipe SkyCrew termine 2ème au rallye aérien régional. Bravo à nos pilotes !',
      text: `<h2>2ème place au rallye aérien régional !</h2>
<p>Notre équipe composée de <strong>Lucas Moreau</strong> et <strong>Antoine Roux</strong> a brillamment représenté le club lors du rallye aérien inter-clubs de la région.</p>
<h3>Résultats</h3>
<ul>
<li>1er : Aéroclub de Bordeaux (487 points)</li>
<li><strong>2ème : SkyCrew Aviation Club (472 points)</strong></li>
<li>3ème : Aéroclub du Bassin d'Arcachon (451 points)</li>
</ul>
<p>Le rallye comprenait 5 épreuves : navigation de précision, atterrissage de précision, reconnaissance de points au sol, économie de carburant et QCM réglementaire.</p>
<p>Félicitations à Lucas et Antoine pour cette belle performance ! 🏆</p>`,
      tags: ['compétition', 'rallye', 'résultats'],
      eventDate: new Date(now.getTime() - 15 * 24 * 3600000),
    },
    {
      title: 'Stage de perfectionnement montagne - Inscriptions ouvertes',
      description: 'Un stage de vol en montagne est organisé en partenariat avec l\'altiport de Courchevel.',
      text: `<h2>Stage Montagne - Été 2026</h2>
<p>En partenariat avec l'altiport de Courchevel (LFLJ), nous organisons un <strong>stage de perfectionnement au vol en montagne</strong> du 1er au 5 juillet.</p>
<h3>Programme</h3>
<ul>
<li>Jour 1 : Théorie - aérologie de montagne, effets de l'altitude</li>
<li>Jour 2 : Vol en vallée, approche d'altiports</li>
<li>Jour 3 : Atterrissages en altitude (Courchevel, Méribel)</li>
<li>Jour 4 : Navigation en relief montagneux</li>
<li>Jour 5 : Vol de synthèse et évaluation</li>
</ul>
<h3>Prérequis</h3>
<p>PPL valide, minimum 100h de vol total, qualification montagne souhaitée mais non obligatoire.</p>
<p><strong>Tarif :</strong> 1 800€ (incluant avion, instructeur, hébergement)</p>
<p>Places limitées à 6 participants. Inscriptions avant le 15 mai auprès de Marie Laurent.</p>`,
      tags: ['stage', 'montagne', 'perfectionnement'],
      eventDate: new Date(now.getFullYear(), 6, 1, 8, 0),
    },
  ];

  for (const data of demoArticles) {
    const article = articleRepository.create(data);
    await articleRepository.save(article);
  }

  console.log(`${demoArticles.length} demo articles created`);
};
