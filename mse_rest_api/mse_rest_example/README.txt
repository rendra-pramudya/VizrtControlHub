MSE REST Examples
=================

Overview
--------
MSE REST Example is a C# sample solution showing how to achieve basic MSE tasks 
with the use of MSE REST API. Currently, there are 10 example projects within the
solution which are:

CreatePageUsingDefaultTemplates
    An example that shows how to create page from default-templates by posting 
    a default-template model called playload to the playlist’ url. 
     
CreatePageUsingMOSItem
    An example that shows how to create a Viz Content Pilot page by posting
    a MOS item to Element Collection Resource.

CreatePageUsingNLESerializedObject
    An example that shows how to create a Trio page by posting an
    NLE Serialized Object to Element Collection Resource.

CreatePageUsingVdfDocument
    An example that shows how to create a Trio page by obtaining a VDF Model
    from an Element Resource. Then construct a VDF Document from the obtained
    VDF Model. Finally, post the created VDF Document to
    Element Collection Resource.

DirectoryHandling
    An example that shows how to create/delete a Directory Resource and
    create/delete a Playlist Resource within directory.

ElementExecution
    An example that shows how to use URIs of an element_collection, 
    an element_collection_entry and a profile to execute profile commands on
    a Trio show and a page.

ElementUpdating
    An example that shows how to update "alternative_concept" and "data"
    of an existing element.

MCPLookupElementBasedOnExternalID
    An example that shows how to find an Element Collection Entry Resource
    by using an External ID.

ProfileCollection
    An example that shows how to query all profiles with its supported actions
    and output connection status.

QueryElementProperties
    An example that shows how to query "loaded_status", "available_status"
    and "thumbnail_uri" of an Element Collection Entry Resource.

TemplateCollection
    An example that shows how to navigate and obtain a Template Collection Resource
    and loop through the collection, parse the Template Collection Entry within.


Setup environment for testing MSE REST example
----------------------------------------------

Each example has its own preparation steps. Please look into the main function
of the example you interested to find the required preparation steps for
that project.
	
Note: A profile used in examples is configured to connect to a local VizEngine.

	
Build and Run
-------------
All projects can be compiled and built with Microsoft Visual Studio 2012. In 
case that there are any errors occurred, 

Each project is a console application which will perform a predefined set of actions.
Since all example applications need to communicate with MSE, please make sure 
that there is MSE installed and running on the specified machine. Local machine
is a default machine and it is possible to change specified machine in the source
code of each project.

Moreover, all of executable projects need specific resources (scenes) to execute
correctly. These scenes and a configuration file are available in "TestResources"
under each project.

Copyright
---------
Vizrt holds the copyright to the bundled example code, but grants anyone legal 
permission to copy and modify it.
