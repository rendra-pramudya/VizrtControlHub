using System;
using System.Collections.Generic;
using System.Xml;

namespace ProfileCollection
{
    class ProfileCollectionExample
    {
        private XmlNamespaceManager nameSpaceManager_;

        public ProfileCollectionExample()
        {
            nameSpaceManager_ = new XmlNamespaceManager(new NameTable());
            nameSpaceManager_.AddNamespace("viz", "http://www.vizrt.com/atom");
            nameSpaceManager_.AddNamespace("atom", "http://www.w3.org/2005/Atom");
            nameSpaceManager_.AddNamespace("vdf", "http://www.vizrt.com/types");
            nameSpaceManager_.AddNamespace("app", "http://www.w3.org/2007/app");
            nameSpaceManager_.AddNamespace("vaext", "http://www.vizrt.com/atom-ext");
        }

        private XmlDocument LoadXMLFromUri(string uri)
        {
            XmlDocument doc = new XmlDocument();
            doc.Load(uri);
            return doc;
        }

        private List<string> GetValuesFromDocumentByXPath(XmlDocument doc, string xpath)
        {
            var result = new List<String>();
            var nav = doc.CreateNavigator();
            var it = nav.Select(xpath, nameSpaceManager_);
            while (it.MoveNext())
            {
                result.Add(it.Current.Value);
            }

            return result;
        }

        public List<string> ListProfiles()
        {
            // Get profiles document.
            var doc = LoadXMLFromUri("http://127.0.0.1:8580/profiles");
            var uris = GetValuesFromDocumentByXPath(doc, "//atom:feed/atom:entry/atom:link[@rel='self']/@href");

            return uris;
        }

        public XmlDocument LoadProfileDocument(string profileUri)
        {
            XmlDocument profileDocument = new XmlDocument();
            profileDocument.Load(profileUri);

            return profileDocument;
        }

        public List<string> ListActionUris(XmlDocument docProfile)
        {
            var uris = GetValuesFromDocumentByXPath(docProfile, "//atom:entry/atom:link[@rel != 'self' and @rel != 'alternate']/@href");

            return uris;
        }

        public List<string> ListChannels(XmlDocument docProfile)
        {
            var channels = GetValuesFromDocumentByXPath(docProfile,
                "//atom:entry/atom:content/vdf:payload/vdf:field[@name='channels']/vdf:list/vdf:payload/vdf:field[@name='name']/vdf:value");

            return channels;
        }

        public List<string> ListChannelOutputUris(XmlDocument docProfile)
        {
            var outputs = GetValuesFromDocumentByXPath(docProfile,
                "//atom:entry/atom:content/vdf:payload/vdf:field[@name='channels']/vdf:list/vdf:payload/vdf:field[@name='outputs']/vdf:list/vdf:payload/vdf:field[@name='output']/vdf:value");

            return outputs;
        }

        public string GetOutputConnectionStatus(string outputUri)
        {
            // Get output document
            var doc = LoadXMLFromUri(outputUri);

            var statuses = GetValuesFromDocumentByXPath(doc, "//vdf:payload/vdf:field[@name='connected']/vdf:value");
            if (statuses.Count == 0)
                return "fatal error: cannot get connection status";

            return statuses[0];
        }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.Write(
@"This is the profile listing example.

This example will query all profiles with its supported actions and
output connection status.

To setup environment for this example:
1. Load the ""default.xml"" in ""TestResources"" folder by copying it to
   ""%programdata%\Vizrt\Media Sequencer"".
2. Open MSE.
3. Load Trio's show ""example_show.trioshow"" in ""TestResources"" folder
   to Viz Trio.

Press enter : ");
            Console.ReadLine();

            var myExample = new ProfileCollectionExample();
            var profiles = myExample.ListProfiles();
            foreach (var profile in profiles)
            {
                Console.WriteLine();
                Console.WriteLine("Profile: {0}", profile);

                var profileDocument = myExample.LoadProfileDocument(profile);

                var actions = myExample.ListActionUris(profileDocument);
                if (actions.Count > 0)
                {
                    Console.WriteLine("actions support:");
                    foreach (var action in actions)
                    {
                        Console.WriteLine("\t{0}", action);
                    }
                }

                var channels = myExample.ListChannels(profileDocument);
                foreach (var channel in channels)
                {
                    Console.WriteLine("channel: {0}", channel);

                    var outputs = myExample.ListChannelOutputUris(profileDocument);
                    if (outputs.Count > 0)
                    {
                        Console.WriteLine("\toutputs:");
                        foreach (var output in outputs)
                        {
                            Console.WriteLine("\t\t{0} (connected: {1})",
                                output, myExample.GetOutputConnectionStatus(output));
                        }
                    }
                }

                Console.WriteLine();
            }
        }
    }
}
