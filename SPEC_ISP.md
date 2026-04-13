Aquí es donde se requiere que actúes con experiencia en redes de Internet, ruteadores, protocolos como ISIS y BGP.

Agrega un branch con el nombre de "new_feature_isp"

Revisa todo y hazme preguntas aclaratorias, antes de comenzar a ejecutar.

La red cuenta con ruteadores marca Cisco y Juniper principalmente.
Hay sitios que cuentan con mas de un ruteador, pero de momento por simplicidad, solo se considerara un ruteador por sitio.
Los ruteadores deberán de tener las siguientes variables:
- Nombre
- Marca
- Interface 	# pueden haber varias interfaces, por lo que se debe de tener opción de agregar mas interfaces cada que se agregue una lambda
		# Hay interfaces conectadas a lambdas, asigna de momento nombres aleatorios, que mas adelante modificare
		# Hay interfaces conectadas a un proveedor de servicio de Internet (Arelion, Gold Data, Meta, Amazon, Akamai)
		# Hay interfaces a los switches de Data Center, de momento no las representaremos
		# Todas las interfaces a representar son de 100 Gbps
Los proveedores de Internet, representalos con una pequeña nube, con un color diferente para cada proveedor
- Arerion 
- Gold Data 
- Cirion 
- Meta 
- Amazon
- Akamai

Representa a los ruteadores Juniper con un circulo verde relleno de verde, con una cruz de color blanco en medio del circulo, es algo similar a la topología típica de un ruteador.
Representa a los ruteadores Cisco con un circulo azul relleno de color azul, una cruz de color blanco  en medio del circulo, es algo similar a la topología típica de un ruteador.
Los ruteadores Juniper se encuentra en los sitios:
- Cd Juarez
- Nuevo Laredo
- Reynosa Iusatel
- KIO Networks Queretaro
Los ruteadores Cisco se encuentran en los sitios:
- MSO Megacentro
- MSO Apodaca
- MSO Tlaquepaque
- MSO Toluca
En los sitios de Cirion, la lambda llega a un ruteador de Cirion, puedes usar la nube que representa a Cirion en lugar del ruteador, o color un ruteador adentro de la nube.
- Cirion Humboldt
- Cirion Mirlo
- Cirion Zurich

Algo que se detecto, es que no hay protección óptica, las lambdas que siguen diferentes trayectorias entre los mismos sitios, están ambos trabajando activos, por lo que los ruteadores balancean trafico entre las diferentes trayectoria.

Para las siguientes lambas, define la correspondencia de lambdas a ruteadores:
- Apodaca to Megacentro		
- Cd Juarez to Apodaca	
- Cd Juarez to Megacentro	
- Cd Juarez to Tlaquepaque	
- Cd Juarez to Toluca	
- Cirion Humboldt to Apodaca Plano 1			
- Cirion Humboldt to Apodaca Plano 2			
- Cirion Mirlo to Tlaquepaque Plano	 	
- Cirion Zurich to Megacentro		
- Cirion Zurich to Toluca		
- KIO Networks Qro to Megacentro Plano 1			
- KIO Networks Qro to Megacentro Plano 2			
- Laredo to Apodaca				
- Laredo to Megacentro				
- Laredo to Tlaquepaque		
- Laredo to Toluca				
- Megacentro to Toluca			
- Reynosa to Apodaca		
- Reynosa to Megacentro	
- Reynosa to Tlaquepaque		
- Reynosa to Toluca	
- Tlaquepaque to Apodaca		
- Toluca to Tlaquepaque

Para los siguientes servicios de ISP, en donde la conexión al ruteador es local, en el sitio propio o de tercero, se tienen la siguientes capacidades
- Arelion, sitio "Cd Juarez",  capacidad: 3 interfaces de 100 Gbps al ruteador local Juniper 
- Gold Data, sitio "Nuevo Laredo", capacidad: 2 interfaces de 100 Gbps al ruteador local Juniper 
- Gold Data, sitio "Reynosa Iusatel", capacidad: 2 interfaces de 100 Gbps al ruteador local Juniper 
- Cirion, sitio "Cirion Humboldt", el ruteador es de Cirion, sin embargos e asigna una interface de 100 Gbps para cada lambda
- Cirion, sitio "Cirion Mirlo", el ruteador es de Cirion, sin embargos e asigna una interface de 100 Gbps para cada lambda
- Cirion, sitio "Cirion Zurich", el ruteador es de Cirion, sin embargos e asigna una interface de 100 Gbps para cada lambda 
- Meta,  sitio "KIO Networks Queretaro", capacidad: 2 interfaces de 100Gps al ruteador local Juniper
- Amazon, sitio "KIO Networks Queretaro", capacidad: 2 interfaces de 100Gps al ruteador local Juniper
- Akamai, sitio "KIO Networks Queretaro", capacidad: 2 interfaces de 100Gps al ruteador local Juniper

Haz una matriz de trafico entre los sitios, que incialmente llenare de manera manual, en la que los flujos de trafico de bajada de Internet, ya quee s el trafco de mayor volumen serán:
- Cd Juarez to Apodaca	
- Cd Juarez to Megacentro	
- Cd Juarez to Tlaquepaque	
- Cd Juarez to Toluca	
- Laredo to Apodaca				
- Laredo to Megacentro				
- Laredo to Tlaquepaque		
- Laredo to Toluca					
- Reynosa to Apodaca		
- Reynosa to Megacentro	
- Reynosa to Tlaquepaque		
- Reynosa to Toluca	
- Cirion Humboldt to Apodaca Plano 1			
- Cirion Humboldt to Apodaca Plano 2			
- Cirion Mirlo to Tlaquepaque Plano	 	
- Cirion Zurich to Megacentro		
- Cirion Zurich to Toluca		
- KIO Networks Qro to Megacentro (Meta)			
- KIO Networks Qro to Apodaca (Meta), usa la lambda de Megacentro a Apodaca			
- KIO Networks Qro to Tlaquepaque (Meta), usa la lambda de Megacentro a Toluca y Apodaca 
- KIO Networks Qro to Toluca (Meta), usa la lambda de Megacentro a Toluca			
- KIO Networks Qro to Megacentro (Amazon)			
- KIO Networks Qro to Apodaca (Amazon), usa la lambda de Megacentro a Apodaca			
- KIO Networks Qro to Tlaquepaque (Amazon), usa la lambda de Megacentro a Toluca y Apodaca 
- KIO Networks Qro to Toluca (Amazon), usa la lambda de Megacentro a Toluca
- KIO Networks Qro to Megacentro (Akamai)			
- KIO Networks Qro to Apodaca (Akamai), usa la lambda de Megacentro a Apodaca			
- KIO Networks Qro to Tlaquepaque (Akamai), usa la lambda de Megacentro a Toluca y Apodaca 
- KIO Networks Qro to Toluca (Akamai), usa la lambda de Megacentro a Toluca
Esta matriz debe de actualizarce cuando agregue mas lambdas 
A futuro estos datos serán agregados via una API

Crea un dashbboard, que me permita ver la utilización de cada interface y cada proveedor.
Calcula como se dividiría el trafico cuando se simule una o varias fallas de manera manual.
De las simulaciones a considerar, permite que pueda seleccionar varios tipos de fallas:
- Fallas de un proveedor de Internet: Arelion, Gold Data en algún sitio, Cirion en algún sitio, Meta o Akamai, o Amazon en el sitio de KIO QUeretaro
- Fallas de alguna o varias lambdas
Calcula como se dividiría el trafico cuando se simule una o varias fallas, permite que pueda indicar de manera manual las fallas que quiero evaluar.
Desarrolla una función que permita simular varias fallas de manera automática, y me genere un reporte de cuales son las fallas mas criticas que ocasionarían saturación de enlaces. 

